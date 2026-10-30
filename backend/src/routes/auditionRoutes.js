const express = require("express");
const router = express.Router();

const auditionController = require("../controllers/auditionController");

router.get("/:casting_call_id", auditionController.getAuditionSlots);

router.post("/:casting_call_id", auditionController.createAuditionSlot);

module.exports = router;
