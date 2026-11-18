const express = require("express");

const auditionController = require("../controllers/auditionController");
const { requireRole, protectMutation } = require("../auth/middleware");

function createAuditionRouter({ config, controller = auditionController, writesEnabled = false }) {
    const router = express.Router();

    router.get("/:casting_call_id", requireRole("candidate", "employer"), controller.getAuditionSlots);
    const write = (_req,res,next) => writesEnabled ? next() : res.status(503).json({error:'Upisi audicija nisu omogućeni.'});

    router.post("/:casting_call_id", requireRole("employer"), protectMutation(config), write, controller.createAuditionSlot);

    router.patch("/:casting_call_id/slots/:slot_id/cancel", requireRole("employer"), protectMutation(config), write, controller.cancelAuditionSlot);

    return router;
}

module.exports = { createAuditionRouter };
