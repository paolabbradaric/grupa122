const { Router } = require("express");
const { requireRole, protectMutation } = require("../auth/middleware");
const { createAuditionWorkflowModel } = require("../models/auditionModels");
const validId = (value) =>
  /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
function createBookingRouter({
  config,
  candidateWrites = false,
  employerWrites = false,
  model = createAuditionWorkflowModel(),
} = {}) {
  const router = Router();
  const protect = protectMutation(config);
  const ids = (req, res, next) =>
    Object.values(req.params).every(validId)
      ? next()
      : res.status(400).json({ error: "Neispravan ID." });
  const write = (enabled) => (req, res, next) =>
    enabled
      ? next()
      : res.status(503).json({ error: "Upisi rezervacija nisu omogućeni." });
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/candidate/applications/:id/booking",
    requireRole("candidate"),
    ids,
    async (req, res) =>
      res.json({
        booking: await model.getBooking(req.user.id, Number(req.params.id)),
      }),
  );
  router.put(
    "/candidate/applications/:id/booking",
    requireRole("candidate"),
    protect,
    ids,
    write(candidateWrites),
    async (req, res) => {
      if (
        !req.body ||
        Object.keys(req.body).some((k) => k !== "slotId") ||
        !validId(req.body.slotId)
      )
        return res.status(400).json({ error: "Neispravan termin." });
      res.json({
        booking: await model.book(
          req.user.id,
          Number(req.params.id),
          Number(req.body.slotId),
        ),
      });
    },
  );
  router.delete(
    "/candidate/applications/:id/booking",
    requireRole("candidate"),
    protect,
    ids,
    write(candidateWrites),
    async (req, res) =>
      res.json(await model.cancelBooking(req.user.id, Number(req.params.id))),
  );
  router.get(
    "/employer/castings/:id/bookings",
    requireRole("employer"),
    ids,
    async (req, res) =>
      res.json({
        bookings: await model.listBookings(req.user.id, Number(req.params.id)),
      }),
  );
  router.patch(
    "/employer/castings/:id/bookings/:bookingId/attendance",
    requireRole("employer"),
    protect,
    ids,
    write(employerWrites),
    async (req, res) => {
      if (
        !req.body ||
        Object.keys(req.body).some((k) => k !== "attendanceStatus") ||
        !["attended", "absent"].includes(req.body.attendanceStatus)
      )
        return res.status(400).json({ error: "Neispravan status dolaska." });
      res.json(
        await model.attendance(
          req.user.id,
          Number(req.params.id),
          Number(req.params.bookingId),
          req.body.attendanceStatus,
        ),
      );
    },
  );
  return router;
}
module.exports = { createBookingRouter };
