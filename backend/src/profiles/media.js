const sharp = require("sharp");
const { randomUUID } = require("node:crypto");
const { AuthError } = require("../auth/errors");
async function validateImages(files) {
  if (!files?.length)
    throw new AuthError(400, "FILE_REQUIRED", "Odaberi sliku.");
  return Promise.all(
    files.map(async (file) => {
      try {
        const image = sharp(file.buffer, {
          limitInputPixels: 20000000,
          failOn: "warning",
        });
        const meta = await image.metadata();
        const type = { jpeg: "image/jpeg", png: "image/png" }[meta.format];
        if (!type || file.mimetype !== type || (meta.pages || 1) > 1)
          throw new Error("format");
        // Full decode and re-encode rejects truncation and strips private EXIF metadata.
        const buffer = await image.rotate().toFormat(meta.format).toBuffer();
        const name =
          file.originalname.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 200) ||
          "slika";
        if (buffer.length > file.size * 10 + 5242880)
          throw new Error("decoded size");
        return {
          buffer,
          type,
          name,
          key: `profiles/${randomUUID()}.${meta.format === "jpeg" ? "jpg" : "png"}`,
        };
      } catch {
        throw new AuthError(
          415,
          "INVALID_IMAGE",
          "Odaberi ispravnu JPG ili PNG sliku do 20 milijuna piksela.",
        );
      }
    }),
  );
}
function createMediaService(pool, storage, model) {
  async function cleanup(minAgeSeconds = 3600) {
    const { rows } = await pool.query(
      `SELECT o.storage_key FROM profile_storage_objects o WHERE o.created_at < CURRENT_TIMESTAMP - ($1 * interval '1 second') AND NOT EXISTS (SELECT 1 FROM media_files m WHERE m.storage_key=o.storage_key) ORDER BY o.created_at LIMIT 100`,
      [minAgeSeconds],
    );
    let removed = 0;
    for (const row of rows) {
      try {
        await storage.remove(row.storage_key);
        await pool.query(
          "DELETE FROM profile_storage_objects WHERE storage_key=$1",
          [row.storage_key],
        );
        removed++;
      } catch {
        /* Durable ledger retains the key for the next maintenance run. */
      }
    }
    return { removed, pending: rows.length - removed };
  }
  async function upload(user, purpose, files) {
    const images = await validateImages(files);
    // Ledger commits before any external write, including uncertain network outcomes.
    for (const f of images)
      await pool.query(
        "INSERT INTO profile_storage_objects(storage_key) VALUES ($1)",
        [f.key],
      );
    try {
      for (const f of images) await storage.put(f.key, f.buffer, f.type);
      await model.changeMedia(user, purpose, images);
    } catch (error) {
      for (const f of images) {
        try {
          const linked = await pool.query(
            "SELECT 1 FROM media_files WHERE storage_key=$1 LIMIT 1",
            [f.key],
          );
          if (linked.rowCount) continue; // COMMIT outcome may be uncertain after a connection failure.
          await storage.remove(f.key);
          await pool.query(
            "DELETE FROM profile_storage_objects WHERE storage_key=$1",
            [f.key],
          );
        } catch {
          /* Retry via ledger. */
        }
      }
      throw error;
    }
    return model.read(user);
  }
  return { upload, cleanup };
}
module.exports = { validateImages, createMediaService };
