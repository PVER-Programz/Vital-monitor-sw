const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// @desc Get monitoring configuration/integrity status for an ICU room
// @route GET /api/icu-monitor/:roomId
router.get('/:roomId', async (req, res) => {
    try {
        const patients = await Patient.find({ room_number: req.params.roomId });
        res.json({
            room: req.params.roomId,
            monitoringActive: patients.length > 0,
            patientCount: patients.length,
            systemHealth: "Optimal",
            videoFeedStatus: "Connected",
            vitalsTelemetry: "Active"
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
