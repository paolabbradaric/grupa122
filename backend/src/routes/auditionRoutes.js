const express = require("express");

const auditionController = require("../controllers/auditionController");
const { requireRole, protectMutation } = require("../auth/middleware");

function createAuditionRouter({ config, controller = auditionController }) {
    const router = express.Router();

    router.get("/:casting_call_id", requireRole("candidate"), controller.getAuditionSlots);

    router.post("/:casting_call_id", requireRole("employer"), protectMutation(config), controller.createAuditionSlot);

    router.patch("/:casting_call_id/slots/:slot_id/cancel", requireRole("employer"), protectMutation(config), controller.cancelAuditionSlot);

    return router;
}

module.exports = { createAuditionRouter };
