const { AuthError } = require("../auth/errors");
const { createUserModel } = require("../auth/userModel");
const {
  validatePatch,
  candidateFields,
  employerFields,
} = require("./validation");
const missing = () =>
  new AuthError(
    409,
    "PROFILE_MISSING",
    "Računu nedostaje profil ili organizacija. Obrati se podršci.",
  );
function createProfileModel(pool) {
  async function transaction(user, action) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const active = await c.query(
        "SELECT id FROM users WHERE id=$1 AND role=$2 AND deleted_at IS NULL FOR UPDATE",
        [user.id, user.role],
      );
      if (!active.rowCount)
        throw new AuthError(
          401,
          "AUTH_REQUIRED",
          "Potrebna je ponovna prijava.",
        );
      const candidate = user.role === "candidate";
      const r = await c.query(
        candidate
          ? "SELECT * FROM candidate_profiles WHERE user_id=$1 FOR UPDATE"
          : "SELECT * FROM organisations WHERE owner_id=$1 ORDER BY id LIMIT 1 FOR UPDATE",
        [user.id],
      );
      if (!r.rowCount) throw missing();
      const result = await action(c, r.rows[0]);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      if (e.code === "23505")
        throw new AuthError(
          409,
          "PROFILE_CONFLICT",
          "OIB već koristi druga organizacija.",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async function read(user) {
    const summary = await createUserModel(pool).findById(user.id);
    if (!summary || summary.role !== user.role)
      throw new AuthError(401, "AUTH_REQUIRED", "Potrebna je ponovna prijava.");
    const candidate = user.role === "candidate";
    const { rows } = await pool.query(
      candidate
        ? "SELECT * FROM candidate_profiles WHERE user_id=$1"
        : "SELECT * FROM organisations WHERE owner_id=$1 ORDER BY id LIMIT 1",
      [user.id],
    );
    if (!rows[0]) throw missing();
    const row = rows[0],
      profile = { id: row.id };
    for (const [key, col] of Object.entries(
      candidate ? candidateFields : employerFields,
    ))
      profile[key] = Object.hasOwn(summary, key)
        ? summary[key]
        : (row[col] ?? null);
    if (profile.weightKg !== null && candidate)
      profile.weightKg = Number(profile.weightKg);
    const media = await pool.query(
      `SELECT m.id,m.original_name AS name,m.mime_type AS "mimeType",m.size_bytes AS size,p.purpose FROM profile_media p JOIN media_files m ON m.id=p.media_id WHERE p.owner_user_id=$1 AND ${candidate ? "p.candidate_id" : "p.org_id"}=$2 ORDER BY m.id`,
      [user.id, row.id],
    );
    const present = (m) => ({
      id: m.id,
      name: m.name,
      mimeType: m.mimeType,
      size: m.size,
      contentUrl: `/api/profile-media/${m.id}/content`,
    });
    if (candidate) {
      profile.avatar = media.rows.find((m) => m.purpose === "avatar");
      profile.avatar = profile.avatar ? present(profile.avatar) : null;
      profile.portfolio = media.rows
        .filter((m) => m.purpose === "portfolio")
        .map(present);
    } else {
      profile.logo = media.rows.find((m) => m.purpose === "logo");
      profile.logo = profile.logo ? present(profile.logo) : null;
      const v = await pool.query(
        "SELECT status FROM verification WHERE org_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 1",
        [row.id],
      );
      profile.verificationStatus = v.rows[0]?.status ?? null;
    }
    return { user: summary, profile };
  }
  async function patch(user, body) {
    await transaction(user, async (c, row) => {
      const summary = await createUserModel(c).findById(user.id);
      const current = user.role === "candidate" ? { ...summary } : {};
      for (const [key, col] of Object.entries(
        user.role === "candidate" ? candidateFields : employerFields,
      ))
        if (!Object.hasOwn(current, key)) current[key] = row[col] ?? null;
      const values = validatePatch(body, user.role, current);
      if (
        user.role === "employer" &&
        values.regNum &&
        values.regNum !== row.reg_num
      ) {
        const approved = await c.query(
          "SELECT status FROM verification WHERE org_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 1",
          [row.id],
        );
        if (approved.rows[0]?.status === "approved")
          throw new AuthError(
            409,
            "VERIFIED_IDENTITY",
            "OIB odobrene organizacije nije moguće mijenjati bez nove provjere.",
          );
      }
      const fields =
        user.role === "candidate" ? candidateFields : employerFields;
      for (const target of [
        "users",
        user.role === "candidate" ? "candidate_profiles" : "organisations",
      ]) {
        const entries = Object.entries(values).filter(([k]) =>
          target === "users"
            ? ["firstName", "lastName", "birthDate"].includes(k)
            : !["firstName", "lastName", "birthDate"].includes(k),
        );
        if (!entries.length) continue;
        await c.query(
          `UPDATE ${target} SET ${entries.map(([k], i) => `${fields[k]}=$${i + 1}`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=$${entries.length + 1}`,
          [...entries.map(([, v]) => v), target === "users" ? user.id : row.id],
        );
      }
    });
    return read(user);
  }
  async function unlink(c, ids) {
    if (!ids.length) return;
    await c.query("DELETE FROM profile_media WHERE media_id=ANY($1::int[])", [
      ids,
    ]);
    await c.query(
      "DELETE FROM media_files m WHERE id=ANY($1::int[]) AND NOT EXISTS(SELECT 1 FROM application_files a WHERE a.media_file_id=m.id) AND NOT EXISTS(SELECT 1 FROM profile_media p WHERE p.media_id=m.id)",
      [ids],
    );
  }
  async function changeMedia(user, purpose, files, mediaId) {
    return transaction(user, async (c, row) => {
      const column = user.role === "candidate" ? "candidate_id" : "org_id";
      const existing = await c.query(
        `SELECT media_id FROM profile_media WHERE owner_user_id=$1 AND ${column}=$2 AND purpose=$3 ORDER BY media_id`,
        [user.id, row.id, purpose],
      );
      if (files) {
        if (purpose === "portfolio" && existing.rowCount + files.length > 5)
          throw new AuthError(
            409,
            "PORTFOLIO_LIMIT",
            "Portfolio može sadržavati najviše pet slika.",
          );
        if (purpose !== "portfolio")
          await unlink(
            c,
            existing.rows.map((r) => r.media_id),
          );
        for (const f of files) {
          const m = await c.query(
            `INSERT INTO media_files(kind,storage_key,original_name,mime_type,size_bytes,owner_user_id) VALUES ('image',$1,$2,$3,$4,$5) RETURNING id`,
            [f.key, f.name, f.type, f.buffer.length, user.id],
          );
          await c.query(
            `INSERT INTO profile_media(media_id,owner_user_id,${column},purpose) VALUES ($1,$2,$3,$4)`,
            [m.rows[0].id, user.id, row.id, purpose],
          );
        }
      } else {
        const ids = existing.rows
          .filter(
            (r) =>
              purpose !== "portfolio" || String(r.media_id) === String(mediaId),
          )
          .map((r) => r.media_id);
        if (purpose === "portfolio" && !ids.length)
          throw new AuthError(404, "MEDIA_NOT_FOUND", "Slika nije pronađena.");
        await unlink(c, ids);
      }
    });
  }
  async function content(user, id) {
    if (
      !/^[1-9]\d*$/.test(String(id)) ||
      !Number.isSafeInteger(Number(id)) ||
      Number(id) > 2147483647
    )
      throw new AuthError(404, "MEDIA_NOT_FOUND", "Slika nije pronađena.");
    const { rows } = await pool.query(
      `SELECT m.* FROM media_files m JOIN profile_media p ON p.media_id=m.id WHERE m.id=$1 AND p.owner_user_id=$2 AND (($3='candidate' AND p.candidate_id IS NOT NULL) OR ($3='employer' AND p.org_id=(SELECT id FROM organisations WHERE owner_id=$2 ORDER BY id LIMIT 1)))`,
      [id, user.id, user.role],
    );
    if (!rows[0])
      throw new AuthError(404, "MEDIA_NOT_FOUND", "Slika nije pronađena.");
    return rows[0];
  }
  return { read, patch, changeMedia, content };
}
module.exports = { createProfileModel };
