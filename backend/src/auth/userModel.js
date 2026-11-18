const { AuthError } = require('./errors');

const userColumns = 'id, auth_id, email, first_name, last_name, birth_date::text AS birth_date, role, deleted_at';

function presentUser(row) {
  if (!row || row.deleted_at) return null;
  const user = {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date instanceof Date ? row.birth_date.toISOString().slice(0, 10) : row.birth_date,
    role: row.role,
    organization: row.organization || null,
  };
  // Koristi se samo na serveru pri autorizaciji; ne serijalizira se u API odgovore.
  Object.defineProperty(user, 'googleAuthId', { value: row.auth_id });
  return user;
}

function createUserModel(pool) {
  return {
    async provisionAdmin(identity) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serijalizira prve prijave istog subjecta i iste normalizirane adrese.
        for (const key of [`auth:${identity.authId}`, `email:${identity.email}`].sort()) {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        }
        const { rows } = await client.query(
          `SELECT ${userColumns} FROM users WHERE auth_id = $1 OR lower(btrim(email)) = $2 FOR UPDATE`,
          [identity.authId, identity.email],
        );
        if (rows.some(row => row.auth_id !== identity.authId)) {
          throw new AuthError(409, 'ACCOUNT_CONFLICT', 'Račun nije moguće povezati. Prijavi se izvornim Google računom.');
        }
        const existing = rows[0];
        if (existing?.deleted_at) throw new AuthError(403, 'ACCOUNT_DISABLED', 'Korisnički račun nije aktivan.');
        const result = existing
          ? await client.query(`UPDATE users SET role = 'admin', email = $2, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1 RETURNING ${userColumns}`, [existing.id, identity.email])
          : await client.query(`INSERT INTO users (auth_id, email, first_name, last_name, birth_date, role)
              VALUES ($1, $2, $3, $4, NULL, 'admin') RETURNING ${userColumns}`,
            [identity.authId, identity.email, identity.firstName?.trim() || null, identity.lastName?.trim() || null]);
        await client.query('COMMIT');
        return presentUser(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') throw new AuthError(409, 'ACCOUNT_CONFLICT', 'Račun ili e-mail već postoji.');
        throw error;
      } finally {
        client.release();
      }
    },
    async findById(id) {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
      if (rows[0]?.role === 'employer') {
        const organisation = await pool.query(
          'SELECT id, company_name, reg_num, contact_email, phone, location FROM organisations WHERE owner_id = $1 ORDER BY id LIMIT 1', [id],
        );
        rows[0].organization = organisation.rows[0] || null;
      }
      return presentUser(rows[0]);
    },
    async findByAuthId(authId) {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE auth_id = $1`, [authId]);
      if (rows[0]?.deleted_at) throw new AuthError(403, 'ACCOUNT_DISABLED', 'Korisnički račun nije aktivan.');
      return presentUser(rows[0]);
    },
    async register(identity, profile) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO users (auth_id, email, first_name, last_name, birth_date, role)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${userColumns}`,
          [identity.authId, identity.email, profile.firstName, profile.lastName, profile.birthDate, profile.role],
        );
        const user = presentUser(rows[0]);
        if (profile.role === 'candidate') {
          await client.query('INSERT INTO candidate_profiles (user_id) VALUES ($1)', [user.id]);
        } else {
          const organisation = await client.query(
            `INSERT INTO organisations (owner_id, company_name, reg_num, contact_email, phone, location)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, company_name, reg_num, contact_email, phone, location`,
            [user.id, profile.companyName, profile.regNum, profile.contactEmail, profile.phone, profile.location],
          );
          user.organization = organisation.rows[0];
        }
        await client.query('COMMIT');
        return user;
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
          throw new AuthError(409, 'ACCOUNT_CONFLICT', 'Račun, e-mail ili OIB već postoji. Prijavi se izvornim Google računom.');
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { createUserModel };
