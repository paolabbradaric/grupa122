
const pool = require('../config/db');

function createEmployerApplicationsModel(database = pool) {
  return {
    async listByCasting(employerId, castingId) {
      // Provjeravamo pripada li casting prijavljenom poslodavcu.
      const castingResult = await database.query(`
        SELECT c.id, c.title, c.status
        FROM casting_calls c
        JOIN projects p ON p.id = c.project_id
        JOIN organisations o ON o.id = p.org_id
        WHERE c.id = $1 AND o.owner_id = $2
      `, [castingId, employerId]);

      if (castingResult.rows.length === 0) {
        return { outcome: 'not_found' };
      }

      // Dohvaćamo prijave i osnovne podatke kandidata.
      const applicationsResult = await database.query(`
        SELECT
          a.id,
          a.status,
          a.cover_letter AS "coverLetter",
          a.video_url AS "videoUrl",
          a.submitted_at AS "submittedAt",
          a.candidate_id AS "candidateId",
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          cp.city,
          cp.country,
          cp.bio,
          cp.experience
        FROM applications a
        JOIN candidate_profiles cp ON cp.id = a.candidate_id
        JOIN users u ON u.id = cp.user_id
        WHERE a.casting_call_id = $1
        ORDER BY a.submitted_at DESC, a.id DESC
      `, [castingId]);

      return {
        outcome: 'success',
        casting: castingResult.rows[0],
        applications: applicationsResult.rows
      };
    }
  };
}

module.exports = { createEmployerApplicationsModel };
