const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// @desc Get all alerts
// @route GET /api/alerts
router.get('/', async (req, res) => {
    try {
        const alerts = await Alert.find({}).sort({ timestamp: -1 }).limit(100);
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc Get alerts for specific patient
// @route GET /api/alerts/patient/:patientId
router.get('/patient/:patientId', async (req, res) => {
    try {
        const alerts = await Alert.find({ patient_id: req.params.patientId }).sort({ timestamp: -1 });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc Create a new alert
// @route POST /api/alerts
router.post('/', async (req, res) => {
    const { patient_id, patient_name, alert_type, severity, message } = req.body;
    try {
        const alert = new Alert({
            patient_id,
            patient_name,
            alert_type,
            severity,
            message
        });
        const createdAlert = await alert.save();
        res.status(201).json(createdAlert);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
