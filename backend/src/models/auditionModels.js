const pool = require("../config/db");
const { AuthError } = require("../auth/errors");
const fail = (status, code, message) => {
  throw new AuthError(status, code, message);
};

function createAuditionWorkflowModel(database = pool) {
  async function transaction(action) {
    const c = await database.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      const result = await action(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      if (e.code === "23505")
        fail(409, "BOOKING_CONFLICT", "Prijava već ima aktivnu rezervaciju.");
      if (e.code === "23514" && e.constraint === "audition_booking_capacity")
        fail(409, "SLOT_FULL", "Termin je popunjen.");
      if (e.code === "23514" && e.constraint === "audition_booking_eligible")
        fail(409, "SLOT_UNAVAILABLE", "Termin nije raspoloživ.");
      if (["40001", "40P01"].includes(e.code))
        fail(
          409,
          "BOOKING_RETRY",
          "Podaci su se promijenili. Ponovno pokušaj.",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async function ownedCasting(c, userId, id) {
    const {
      rows: [row],
    } = await c.query(
      `SELECT c.id,c.status FROM casting_calls c JOIN projects p ON p.id=c.project_id
      JOIN organisations o ON o.id=p.org_id WHERE c.id=$1 AND o.owner_id=$2 FOR UPDATE OF c`,
      [id, userId],
    );
    if (!row) fail(404, "CASTING_NOT_FOUND", "Oglas nije pronađen.");
    return row;
  }
  async function ownedApplication(c, userId, id) {
    const {
      rows: [reference],
    } = await c.query(
      `SELECT a.casting_call_id FROM applications a
      JOIN candidate_profiles cp ON cp.id=a.candidate_id WHERE a.id=$1 AND cp.user_id=$2`,
      [id, userId],
    );
    if (!reference)
      fail(404, "APPLICATION_NOT_FOUND", "Prijava nije pronađena.");
    const {
      rows: [casting],
    } = await c.query(
      "SELECT id,status FROM casting_calls WHERE id=$1 FOR UPDATE",
      [reference.casting_call_id],
    );
    const {
      rows: [application],
    } = await c.query(
      `SELECT a.id,a.status,a.casting_call_id FROM applications a
      JOIN candidate_profiles cp ON cp.id=a.candidate_id WHERE a.id=$1 AND cp.user_id=$2 FOR UPDATE OF a`,
      [id, userId],
    );
    if (!application || !casting)
      fail(404, "APPLICATION_NOT_FOUND", "Prijava nije pronađena.");
    return { application, casting };
  }
  async function notify(c, applicationId, bookingId, message) {
    await c.query(
      `INSERT INTO notifications(user_id,type,title,message,application_id,casting_call_id,booking_id)
      SELECT recipient,'audition','Promjena audicije',$3,a.id,a.casting_call_id,$2
      FROM applications a JOIN candidate_profiles cp ON cp.id=a.candidate_id
      JOIN casting_calls cc ON cc.id=a.casting_call_id JOIN projects p ON p.id=cc.project_id
      JOIN organisations o ON o.id=p.org_id CROSS JOIN LATERAL
        (SELECT cp.user_id AS recipient UNION SELECT o.owner_id) recipients WHERE a.id=$1`,
      [applicationId, bookingId, message],
    );
  }
  return {
    async list(user, castingId) {
      const {
        rows: [casting],
      } = await database.query(
        `SELECT c.id FROM casting_calls c JOIN projects p ON p.id=c.project_id
        JOIN organisations o ON o.id=p.org_id WHERE c.id=$1 AND
        (($3='employer' AND o.owner_id=$2) OR ($3='candidate' AND c.status IN ('published','closed') AND EXISTS(
          SELECT 1 FROM applications a JOIN candidate_profiles cp ON cp.id=a.candidate_id
          WHERE a.casting_call_id=c.id AND cp.user_id=$2 AND a.status='INVITED')))`,
        [castingId, user.id, user.role],
      );
      if (!casting) fail(404, "CASTING_NOT_FOUND", "Oglas nije pronađen.");
      return (
        await database.query(
          `SELECT s.id,s.starts_at,s.ends_at,s.location,s.capacity,s.status,
        s.capacity-(SELECT count(*)::int FROM audition_bookings b WHERE b.audition_slot_id=s.id
          AND b.status NOT IN ('cancelled','canceled')) AS "availablePlaces"
        FROM audition_slots s WHERE s.casting_call_id=$1 ORDER BY s.starts_at,s.id`,
          [castingId],
        )
      ).rows;
    },
    async create(userId, castingId, data) {
      return transaction(async (c) => {
        const casting = await ownedCasting(c, userId, castingId);
        if (!["published", "closed"].includes(casting.status))
          fail(409, "CASTING_CLOSED", "Oglas ne dopušta stvaranje audicija.");
        const {
          rows: [slot],
        } = await c.query(
          `INSERT INTO audition_slots(casting_call_id,starts_at,ends_at,location,capacity,status)
        VALUES($1,$2,$3,$4,$5,'scheduled') RETURNING id,starts_at,ends_at,location,capacity,status`,
          [
            castingId,
            data.starts_at,
            data.ends_at,
            data.location,
            data.capacity,
          ],
        );
        return slot;
      });
    },
    async cancel(userId, castingId, slotId) {
      return transaction(async (c) => {
        await ownedCasting(c, userId, castingId);
        const {
          rows: [slot],
        } = await c.query(
          "SELECT id,status,starts_at FROM audition_slots WHERE id=$1 AND casting_call_id=$2 FOR UPDATE",
          [slotId, castingId],
        );
        if (!slot) fail(404, "SLOT_NOT_FOUND", "Termin nije pronađen.");
        if (
          slot.status !== "scheduled" ||
          new Date(slot.starts_at) <= new Date()
        )
          fail(409, "INVALID_SLOT_STATUS", "Termin se više ne može otkazati.");
        const { rows: bookings } = await c.query(
          `UPDATE audition_bookings SET status='cancelled',cancelled_at=NOW()
        WHERE audition_slot_id=$1 AND status NOT IN ('cancelled','canceled') RETURNING id,application_id`,
          [slotId],
        );
        for (const booking of bookings)
          await notify(
            c,
            booking.application_id,
            booking.id,
            "Rezervirani termin audicije je otkazan.",
          );
        await c.query(
          "UPDATE audition_slots SET status='cancelled' WHERE id=$1",
          [slotId],
        );
        return {
          id: slotId,
          status: "cancelled",
          message: "Termin je otkazan.",
        };
      });
    },
    async book(userId, applicationId, slotId) {
      return transaction(async (c) => {
        const { application, casting } = await ownedApplication(
          c,
          userId,
          applicationId,
        );
        if (
          application.status !== "INVITED" ||
          !["published", "closed"].includes(casting.status)
        )
          fail(
            409,
            "NOT_INVITED",
            "Rezervirati može samo kandidat pozvan na audiciju otvorenog oglasa.",
          );
        const {
          rows: [guards],
        } =
          await c.query(`SELECT current_setting('session_replication_role')='origin'
        AND EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
          WHERE t.tgrelid='audition_bookings'::regclass AND t.tgname='audition_bookings_capacity_guard'
            AND t.tgfoid=to_regprocedure('guard_audition_booking_capacity()') AND t.tgenabled IN ('O','A') AND NOT p.prosecdef)
        AND EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('one_active_application_booking')
          AND indrelid='audition_bookings'::regclass AND indisunique AND indisvalid AND indisready) AS ready`);
        if (!guards?.ready)
          fail(
            503,
            "BOOKING_GUARDS_UNAVAILABLE",
            "Rezerviranje čeka instalaciju DB zaštite.",
          );
        const {
          rows: [slot],
        } = await c.query(
          `SELECT id,capacity,status,starts_at FROM audition_slots
        WHERE id=$1 AND casting_call_id=$2 FOR UPDATE`,
          [slotId, casting.id],
        );
        if (!slot) fail(404, "SLOT_NOT_FOUND", "Termin nije pronađen.");
        if (
          slot.status !== "scheduled" ||
          new Date(slot.starts_at) <= new Date()
        )
          fail(409, "SLOT_UNAVAILABLE", "Termin nije raspoloživ.");
        const {
          rows: [current],
        } = await c.query(
          `SELECT b.id,b.audition_slot_id,s.starts_at FROM audition_bookings b
        JOIN audition_slots s ON s.id=b.audition_slot_id WHERE b.application_id=$1
        AND b.status NOT IN ('cancelled','canceled') FOR UPDATE OF b`,
          [applicationId],
        );
        if (current?.audition_slot_id === slotId)
          return { id: current.id, slotId, status: "booked" };
        if (current && new Date(current.starts_at) <= new Date())
          fail(
            409,
            "BOOKING_STARTED",
            "Rezervacija održane audicije ne može se mijenjati.",
          );
        const {
          rows: [count],
        } = await c.query(
          `SELECT count(*)::int AS n FROM audition_bookings
        WHERE audition_slot_id=$1 AND status NOT IN ('cancelled','canceled')`,
          [slotId],
        );
        if (count.n >= slot.capacity)
          fail(409, "SLOT_FULL", "Termin je popunjen.");
        if (current)
          await c.query(
            "UPDATE audition_bookings SET status='cancelled',cancelled_at=NOW() WHERE id=$1",
            [current.id],
          );
        const {
          rows: [booking],
        } = await c.query(
          `INSERT INTO audition_bookings(application_id,audition_slot_id,status,booked_at)
        VALUES($1,$2,'booked',NOW()) RETURNING id,status`,
          [applicationId, slotId],
        );
        await notify(
          c,
          applicationId,
          booking.id,
          current
            ? "Kandidat je promijenio rezervirani termin."
            : "Kandidat je rezervirao termin audicije.",
        );
        return { ...booking, slotId };
      });
    },
    async cancelBooking(userId, applicationId) {
      return transaction(async (c) => {
        await ownedApplication(c, userId, applicationId);
        const {
          rows: [booking],
        } = await c.query(
          `SELECT b.id,s.starts_at FROM audition_bookings b JOIN audition_slots s ON s.id=b.audition_slot_id
        WHERE b.application_id=$1 AND b.status NOT IN ('cancelled','canceled') FOR UPDATE OF b`,
          [applicationId],
        );
        if (!booking)
          fail(404, "BOOKING_NOT_FOUND", "Aktivna rezervacija nije pronađena.");
        if (new Date(booking.starts_at) <= new Date())
          fail(
            409,
            "BOOKING_STARTED",
            "Rezervacija održane audicije ne može se mijenjati.",
          );
        await c.query(
          "UPDATE audition_bookings SET status='cancelled',cancelled_at=NOW() WHERE id=$1",
          [booking.id],
        );
        await notify(
          c,
          applicationId,
          booking.id,
          "Kandidat je otkazao rezervaciju audicije.",
        );
        return { id: booking.id, status: "cancelled" };
      });
    },
    async getBooking(userId, applicationId) {
      const {
        rows: [owner],
      } = await database.query(
        `SELECT a.id FROM applications a JOIN candidate_profiles cp ON cp.id=a.candidate_id
        WHERE a.id=$1 AND cp.user_id=$2`,
        [applicationId, userId],
      );
      if (!owner) fail(404, "APPLICATION_NOT_FOUND", "Prijava nije pronađena.");
      return (
        (
          await database.query(
            `SELECT b.id,b.status,b.attendance_status AS "attendanceStatus",b.audition_slot_id AS "slotId",
        s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.location FROM audition_bookings b JOIN audition_slots s ON s.id=b.audition_slot_id
        WHERE b.application_id=$1 ORDER BY b.booked_at DESC,b.id DESC LIMIT 1`,
            [applicationId],
          )
        ).rows[0] || null
      );
    },
    async listBookings(userId, castingId) {
      const {
        rows: [owner],
      } = await database.query(
        `SELECT c.id FROM casting_calls c JOIN projects p ON p.id=c.project_id
        JOIN organisations o ON o.id=p.org_id WHERE c.id=$1 AND o.owner_id=$2`,
        [castingId, userId],
      );
      if (!owner) fail(404, "CASTING_NOT_FOUND", "Oglas nije pronađen.");
      return (
        await database.query(
          `SELECT b.id,b.status,b.attendance_status AS "attendanceStatus",b.application_id AS "applicationId",
        b.audition_slot_id AS "slotId",s.starts_at AS "startsAt",u.first_name AS "firstName",u.last_name AS "lastName"
        FROM audition_bookings b JOIN audition_slots s ON s.id=b.audition_slot_id JOIN applications a ON a.id=b.application_id
        JOIN candidate_profiles cp ON cp.id=a.candidate_id JOIN users u ON u.id=cp.user_id
        WHERE s.casting_call_id=$1 ORDER BY s.starts_at,b.id`,
          [castingId],
        )
      ).rows;
    },
    async attendance(userId, castingId, bookingId, status) {
      return transaction(async (c) => {
        await ownedCasting(c, userId, castingId);
        const {
          rows: [booking],
        } = await c.query(
          `SELECT b.id,b.application_id,b.status,b.attendance_status,s.starts_at FROM audition_bookings b
        JOIN audition_slots s ON s.id=b.audition_slot_id WHERE b.id=$1 AND s.casting_call_id=$2 FOR UPDATE OF b`,
          [bookingId, castingId],
        );
        if (!booking)
          fail(404, "BOOKING_NOT_FOUND", "Rezervacija nije pronađena.");
        if (
          ["cancelled", "canceled"].includes(booking.status) ||
          new Date(booking.starts_at) > new Date()
        )
          fail(
            409,
            "INVALID_ATTENDANCE",
            "Dolazak se može evidentirati tek nakon početka aktivne audicije.",
          );
        if (booking.attendance_status === status)
          return { id: bookingId, attendanceStatus: status };
        await c.query(
          "UPDATE audition_bookings SET attendance_status=$1 WHERE id=$2",
          [status, bookingId],
        );
        await notify(
          c,
          booking.application_id,
          bookingId,
          `Evidencija dolaska: ${status}.`,
        );
        return { id: bookingId, attendanceStatus: status };
      });
    },
  };
}
module.exports = { createAuditionWorkflowModel };
