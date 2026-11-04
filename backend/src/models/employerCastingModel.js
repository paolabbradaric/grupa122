const pool = require('../config/db');

const selectColumns = `
  c.id, c.project_id AS "projectId", p.title AS "projectTitle",
  p.project_type AS "projectType", p.description AS "projectDescription",
  c.title AS "roleTitle", c.description AS "roleDescription",
  c.positions_count AS "positionsCount", c.max_applications AS "maxApplications",
  c.min_age AS "minAge", c.max_age AS "maxAge", c.location,
  c.application_deadline AS "applicationDeadline", c.audition_text AS "auditionText",
  c.appearance_req AS "appearanceReq", c.exp_req AS "experienceReq",
  c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

function createEmployerCastingModel(database = pool) {
  return {
    async listMine(userId) {
      const { rows } = await database.query(`
        SELECT ${selectColumns}
        FROM casting_calls c
        JOIN projects p ON p.id = c.project_id
        JOIN organisations o ON o.id = p.org_id
        WHERE o.owner_id = $1
        ORDER BY c.created_at DESC, c.id DESC`, [userId]);
      return rows;
    },

    async createDraft(userId, data) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const org = await client.query(
          'SELECT id FROM organisations WHERE owner_id = $1 ORDER BY id LIMIT 1',
          [userId]
        );
        if (!org.rows[0]) {
          await client.query('ROLLBACK');
          return { outcome: 'no_organisation' };
        }
        const project = await client.query(`
          INSERT INTO projects (title, project_type, description, org_id)
          VALUES ($1, $2, $3, $4) RETURNING id`,
          [data.projectTitle, data.projectType, data.projectDescription ?? null, org.rows[0].id]
        );
        const created = await client.query(`
          INSERT INTO casting_calls (
            project_id, status, title, description, positions_count,
            max_applications, min_age, max_age, location, application_deadline,
            audition_text, appearance_req, exp_req
          ) VALUES ($1, 'draft', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`, [
          project.rows[0].id, data.roleTitle ?? null,
          data.roleDescription ?? null, data.positionsCount ?? null,
          data.maxApplications ?? 1000, data.minAge ?? null, data.maxAge ?? null,
          data.location ?? null, data.applicationDeadline ?? null,
          data.auditionText ?? null, data.appearanceReq ?? null,
          data.experienceReq ?? null
        ]);
        await client.query('COMMIT');
        return { outcome: 'created', id: created.rows[0].id };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async publishDraft(userId, castingId) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        // Zaključavanje oglasa sprječava istodobnu objavu/uređivanje istog nacrta.
        const { rows: [casting] } = await client.query(`
          SELECT c.id, c.status, c.title, c.description, c.positions_count,
                 c.max_applications, c.min_age, c.max_age, c.location,
                 c.application_deadline, p.title AS project_title,
                 p.project_type, p.description AS project_description, o.id AS org_id
          FROM casting_calls c
          JOIN projects p ON p.id = c.project_id
          JOIN organisations o ON o.id = p.org_id
          WHERE c.id = $1 AND o.owner_id = $2
          FOR UPDATE OF c, p`, [castingId, userId]);
        if (!casting) {
          await client.query('ROLLBACK');
          return { outcome: 'not_found' };
        }
        if (casting.status !== 'draft') {
          await client.query('ROLLBACK');
          return { outcome: 'not_draft' };
        }

        // Samo posljednja odluka o verifikaciji organizacije vrijedi.
        const { rows: [verification] } = await client.query(`
          SELECT status FROM verification
          WHERE org_id = $1
          ORDER BY submitted_at DESC, id DESC
          LIMIT 1`, [casting.org_id]);
        if (verification?.status !== 'approved') {
          await client.query('ROLLBACK');
          return { outcome: 'not_verified' };
        }

        const nonBlank = value => typeof value === 'string' && value.trim().length > 0;
        const positiveInt = value => Number.isSafeInteger(value) && value > 0;
        const deadline = casting.application_deadline && new Date(casting.application_deadline);
        const complete =
          nonBlank(casting.project_title) && nonBlank(casting.project_type) &&
          nonBlank(casting.project_description) &&
          nonBlank(casting.title) && nonBlank(casting.description) &&
          nonBlank(casting.location) && positiveInt(casting.positions_count) &&
          positiveInt(casting.max_applications) && casting.max_applications <= 1000 &&
          Number.isSafeInteger(casting.min_age) && casting.min_age >= 18 &&
          Number.isSafeInteger(casting.max_age) && casting.max_age >= casting.min_age &&
          deadline instanceof Date && Number.isFinite(deadline.getTime()) &&
          deadline.getTime() > Date.now();
        if (!complete) {
          await client.query('ROLLBACK');
          return { outcome: 'incomplete' };
        }

        await client.query(`
          UPDATE casting_calls
          SET status = 'published', published_at = NOW(), updated_at = NOW()
          WHERE id = $1`, [castingId]);
        await client.query('COMMIT');
        return { outcome: 'published', id: castingId };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async updateDraft(userId, castingId, patch) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
          SELECT c.id, c.status, c.project_id,
                 p.title AS "projectTitle", p.project_type AS "projectType",
                 p.description AS "projectDescription",
                 c.title AS "roleTitle", c.description AS "roleDescription",
                 c.positions_count AS "positionsCount", c.max_applications AS "maxApplications",
                 c.min_age AS "minAge", c.max_age AS "maxAge", c.location,
                 c.application_deadline AS "applicationDeadline",
                 c.audition_text AS "auditionText", c.appearance_req AS "appearanceReq",
                 c.exp_req AS "experienceReq"
          FROM casting_calls c
          JOIN projects p ON p.id = c.project_id
          JOIN organisations o ON o.id = p.org_id
          WHERE c.id = $1 AND o.owner_id = $2
          FOR UPDATE OF c, p`, [castingId, userId]);
        const row = result.rows[0];
        if (!row) {
          await client.query('ROLLBACK');
          return { outcome: 'not_found' };
        }
        if (row.status !== 'draft') {
          await client.query('ROLLBACK');
          return { outcome: 'not_draft' };
        }
        const value = key => Object.hasOwn(patch, key) ? patch[key] : row[key];
        // Usporedbu dobi obavljamo i nakon spajanja promjena sa starim vrijednostima.
        const min = value('minAge');
        const max = value('maxAge');
        if (min != null && max != null && max < min) {
          await client.query('ROLLBACK');
          return { outcome: 'invalid_ages' };
        }
        await client.query(`
          UPDATE projects SET title=$1, project_type=$2, description=$3,
          updated_at=NOW() WHERE id=$4`, [
          value('projectTitle'), value('projectType'), value('projectDescription'), row.project_id
        ]);
        await client.query(`
          UPDATE casting_calls SET title=$1, description=$2, positions_count=$3,
          max_applications=$4, min_age=$5, max_age=$6, location=$7,
          application_deadline=$8, audition_text=$9, appearance_req=$10,
          exp_req=$11, updated_at=NOW() WHERE id=$12`, [
          value('roleTitle'), value('roleDescription'), value('positionsCount'),
          value('maxApplications'), min, max, value('location'),
          value('applicationDeadline'), value('auditionText'),
          value('appearanceReq'), value('experienceReq'), castingId
        ]);
        await client.query('COMMIT');
        return { outcome: 'updated', id: castingId };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

module.exports = { createEmployerCastingModel };
