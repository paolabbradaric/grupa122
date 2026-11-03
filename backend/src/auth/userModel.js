const { AuthError } = require('./errors');

const userColumns = 'id, email, first_name, last_name, birth_date::text AS birth_date, role, deleted_at';

function presentUser(row) {
  if (!row || row.deleted_at) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date instanceof Date ? row.birth_date.toISOString().slice(0, 10) : row.birth_date,
    role: row.role,
    organization: row.organization || null,
  };
}

function createUserModel(pool) {
  return {
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
