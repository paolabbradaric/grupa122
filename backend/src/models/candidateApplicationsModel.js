'use strict';

const pool = require('../config/db');
const { notifyApplication } = require('./notificationModel');

// Dogovoreno pravilo F-026: povlačenje prije održane audicije.
const withdrawableStatuses = new Set(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INVITED']);

function createCandidateApplicationsModel(database = pool) {
  return {
    async listMine(userId) {
      const { rows } = await database.query(`
        SELECT a.id, a.status, a.cover_letter AS "coverLetter", a.video_url AS "videoUrl",
               a.rejection_reason AS "rejectionReason", a.submitted_at AS "submittedAt",
               a.updated_at AS "updatedAt", c.id AS "castingId", c.title AS "roleTitle",
               c.status AS "castingStatus", c.location,
               c.application_deadline AS "applicationDeadline",
               p.id AS "projectId", p.title AS "projectTitle", p.project_type AS "projectType"
        FROM applications a
        JOIN candidate_profiles cp ON cp.id = a.candidate_id
        JOIN casting_calls c ON c.id = a.casting_call_id
        JOIN projects p ON p.id = c.project_id
        WHERE cp.user_id = $1
        ORDER BY a.submitted_at DESC, a.id DESC
      `, [userId]);
      return rows;
    },

    async withdraw(userId, applicationId) {
      const client = await database.connect();
      let transaction = false;
      try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        transaction = true;

        // Jednak redoslijed zaključavanja kao pri promjeni statusa i odabiru:
        // prvo oglas, pa prijava. Vlasništvo se provjerava u oba upita.
        const { rows: [casting] } = await client.query(`
          SELECT c.id
          FROM casting_calls c
          JOIN applications a ON a.casting_call_id = c.id
          JOIN candidate_profiles cp ON cp.id = a.candidate_id
          WHERE a.id = $1 AND cp.user_id = $2
          FOR UPDATE OF c
        `, [applicationId, userId]);
        if (!casting) {
          await client.query('ROLLBACK');
          transaction = false;
          return { outcome: 'not_found' };
        }

        const { rows: [application] } = await client.query(`
          SELECT a.id, a.status
          FROM applications a
          JOIN candidate_profiles cp ON cp.id = a.candidate_id
          WHERE a.id = $1 AND a.casting_call_id = $2 AND cp.user_id = $3
          FOR UPDATE OF a
        `, [applicationId, casting.id, userId]);
        if (!application) {
          await client.query('ROLLBACK');
          transaction = false;
          return { outcome: 'not_found' };
        }
        if (!withdrawableStatuses.has(application.status)) {
          await client.query('ROLLBACK');
          transaction = false;
          return { outcome: 'invalid_status' };
        }

        // Bez migracije oba pisca ne bi dijelila isto zaključavanje.
        // Onemogućeni triggeri ili replication režim također zatvaraju upise.
        const { rows: [guards] } = await client.query(`
          SELECT current_setting('session_replication_role') = 'origin'
            AND EXISTS (
              SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
              WHERE t.tgrelid = 'audition_bookings'::regclass
                AND t.tgname = 'audition_bookings_withdrawal_guard'
                AND t.tgfoid = to_regprocedure('guard_active_audition_booking()')
                AND t.tgenabled IN ('O', 'A') AND NOT p.prosecdef
            ) AND EXISTS (
              SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
              WHERE t.tgrelid = 'applications'::regclass
                AND t.tgname = 'applications_withdrawal_guard'
                AND t.tgfoid = to_regprocedure('guard_application_withdrawal()')
                AND t.tgenabled IN ('O', 'A') AND NOT p.prosecdef
            ) AS withdrawal_guards_ready
        `);
        if (!guards?.withdrawal_guards_ready) {
          await client.query('ROLLBACK');
          transaction = false;
          return { outcome: 'integration_unavailable' };
        }

        // Aktivne rezervacije ne ostavljamo uz povučenu prijavu.
        // Njihovo otkazivanje i obavijesti zahtijevaju integraciju s Lucijom.
        const { rows: [bookings] } = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM audition_bookings
            WHERE application_id = $1 AND status NOT IN ('cancelled', 'canceled')
          ) AS has_active_bookings
        `, [applicationId]);
        if (bookings.has_active_bookings) {
          await client.query('ROLLBACK');
          transaction = false;
          return { outcome: 'active_bookings' };
        }

        await client.query(`
          UPDATE applications
          SET status = 'WITHDRAWN', updated_at = NOW()
          WHERE id = $1
        `, [applicationId]);
        await client.query(`
          INSERT INTO application_status_history
            (old_status, new_status, reason, application_id, changed_by)
          VALUES ($1, 'WITHDRAWN', $2, $3, $4)
        `, [application.status, 'Prijavu povukao kandidat.', applicationId, userId]);

        await notifyApplication(client, applicationId, 'application_status', 'Prijava je povučena.', 'Uspješno ste povukli prijavu.');
        await client.query('COMMIT');
        transaction = false;
        return { outcome: 'withdrawn', applicationId, oldStatus: application.status, status: 'WITHDRAWN' };
      } catch (error) {
        if (transaction) {
          try { await client.query('ROLLBACK'); } catch { /* Zadržavamo izvornu grešku. */ }
        }
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

module.exports = { createCandidateApplicationsModel };
