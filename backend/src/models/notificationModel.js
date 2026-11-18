const pool = require("../config/db");

async function notifyApplication(client, applicationId, type, title, message) {
  await client.query(
    `INSERT INTO notifications(user_id,type,title,message,application_id,casting_call_id)
    SELECT cp.user_id,$2,$3,$4,a.id,a.casting_call_id FROM applications a
    JOIN candidate_profiles cp ON cp.id=a.candidate_id WHERE a.id=$1`,
    [applicationId, type, title, message],
  );
}

function createNotificationModel(database = pool) {
  return {
    async listMine(userId, { limit = 50, before = null, unread = false } = {}) {
      const { rows } = await database.query(
        `SELECT id,type,title,message,is_read AS "isRead",
        created_at AS "createdAt",application_id AS "applicationId",casting_call_id AS "castingId",booking_id AS "bookingId"
        FROM notifications WHERE user_id=$1 AND ($2::int IS NULL OR id<$2)
          AND (NOT $3::boolean OR NOT is_read) ORDER BY id DESC LIMIT $4`,
        [userId, before, unread, limit],
      );
      return rows;
    },
    async markRead(userId, id) {
      const { rows } = await database.query(
        `UPDATE notifications SET is_read=true
        WHERE id=$1 AND user_id=$2 RETURNING id,is_read AS "isRead"`,
        [id, userId],
      );
      return rows[0] || null;
    },
  };
}
module.exports = { createNotificationModel, notifyApplication };
