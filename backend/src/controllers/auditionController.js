const { createAuditionWorkflowModel } = require("../models/auditionModels");
const validId = (value) =>
  /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
const calendar = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value.slice(0, 10) + "T00:00:00Z")) &&
  new Date(value.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) ===
    value.slice(0, 10);
function createAuditionController({
  model = createAuditionWorkflowModel(),
} = {}) {
  return {
    async getAuditionSlots(req, res) {
      if (!validId(req.params.casting_call_id))
        return res.status(400).json({ error: "Neispravan ID oglasa." });
      res.json(await model.list(req.user, Number(req.params.casting_call_id)));
    },
    async createAuditionSlot(req, res) {
      const { starts_at, ends_at, location, capacity } = req.body || {};
      const start = new Date(starts_at),
        end = new Date(ends_at);
      if (
        !validId(req.params.casting_call_id) ||
        !calendar(starts_at) ||
        !calendar(ends_at) ||
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        start <= new Date() ||
        end <= start ||
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(starts_at) ||
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(ends_at) ||
        typeof location !== "string" ||
        !location.trim() ||
        location.length > 200 ||
        !Number.isInteger(Number(capacity)) ||
        Number(capacity) < 1 ||
        Number(capacity) > 2147483647 ||
        !["string", "number"].includes(typeof capacity)
      )
        return res.status(400).json({ error: "Neispravni podaci termina." });
      res.status(201).json(
        await model.create(req.user.id, Number(req.params.casting_call_id), {
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          location: location.trim(),
          capacity: Number(capacity),
        }),
      );
    },
    async cancelAuditionSlot(req, res) {
      if (!validId(req.params.casting_call_id) || !validId(req.params.slot_id))
        return res
          .status(400)
          .json({ error: "Neispravan ID oglasa ili termina." });
      res.json(
        await model.cancel(
          req.user.id,
          Number(req.params.casting_call_id),
          Number(req.params.slot_id),
        ),
      );
    },
  };
}
module.exports = { createAuditionController, ...createAuditionController() };
