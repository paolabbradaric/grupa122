const pool = require('../config/db');

// Explicit public fields: never expose organisation contacts or candidate data.
const publicFields = `c.id, c.title, c.description, c.location,
  c.positions_count, c.application_deadline, c.status,
  (SELECT COUNT(*)::int FROM applications a WHERE a.casting_call_id = c.id
    AND a.status IN ('ACCEPTED', 'SELECTED')) AS accepted_count,
  p.id AS project_id, p.title AS project_title, p.project_type,
  p.title AS "projectTitle", c.title AS "roleTitle", p.project_type AS "projectType",
  p.description AS project_description, c.audition_text,
  c.min_age, c.max_age, c.appearance_req, c.exp_req`;

function createCastingModel(database = pool) {
  return {
    // Keep the original location/search arguments for existing callers.
    async getPublishedCastings(location, search, { projectType, age, requirements } = {}) {
      const literalRequirements = requirements?.replace(/[\\%_]/g, '\\$&') || null;
      const { rows } = await database.query(`
        SELECT ${publicFields}
        FROM casting_calls c JOIN projects p ON p.id = c.project_id
        WHERE c.status = 'published'
          AND ($1::text IS NULL OR c.location ILIKE $1)
          AND ($2::text IS NULL OR c.title ILIKE '%' || $2 || '%'
            OR p.title ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR LOWER(p.project_type) = LOWER($3))
          AND ($4::int IS NULL OR
            ((c.min_age IS NULL OR c.min_age <= $4) AND
             (c.max_age IS NULL OR c.max_age >= $4)))
          AND ($5::text IS NULL OR c.appearance_req ILIKE '%' || $5 || '%'
            OR c.exp_req ILIKE '%' || $5 || '%')
        ORDER BY c.created_at DESC, c.id DESC`,
      [location || null, search || null, projectType || null, age ?? null, literalRequirements]);
      return rows;
    },
    async getCastingById(id) {
      const { rows } = await database.query(`
        SELECT ${publicFields}
        FROM casting_calls c JOIN projects p ON p.id = c.project_id
        WHERE c.id = $1 AND c.status = 'published'`, [id]);
      return rows[0] || null;
    }
  };
}

module.exports = { createCastingModel, ...createCastingModel() };
