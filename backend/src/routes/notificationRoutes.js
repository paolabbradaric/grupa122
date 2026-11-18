const { Router } = require("express");
const { requireRole, protectMutation } = require("../auth/middleware");
const { createNotificationModel } = require("../models/notificationModel");
function createNotificationRouter({
  config,
  model = createNotificationModel(),
} = {}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireRole("candidate", "employer"));
  router.get("/", async (req, res) => {
    const { limit = "50", before, unread = "false", ...unknown } = req.query;
    const valid = (value) =>
      typeof value === "string" &&
      /^[1-9]\d*$/.test(value) &&
      Number(value) <= 2147483647;
    if (
      Object.keys(unknown).length ||
      !valid(limit) ||
      Number(limit) > 100 ||
      (before !== undefined && !valid(before)) ||
      !["true", "false"].includes(unread)
    )
      return res.status(400).json({ error: "Neispravni filtri obavijesti." });
    res.json({
      notifications: await model.listMine(req.user.id, {
        limit: Number(limit),
        before: before === undefined ? null : Number(before),
        unread: unread === "true",
      }),
    });
  });
  router.patch("/:id/read", protectMutation(config), async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647)
      return res.status(400).json({ error: "Neispravan ID obavijesti." });
    const result = await model.markRead(req.user.id, Number(req.params.id));
    if (!result)
      return res.status(404).json({ error: "Obavijest nije pronađena." });
    res.json(result);
  });
  return router;
}
module.exports = { createNotificationRouter };
