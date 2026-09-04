const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// @desc Get all patients
// @route GET /api/patient
router.get('/', async (req, res) => {
    try {
        const patients = await Patient.find({});
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc Get single patient
// @route GET /api/patient/:id
router.get('/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (patient) {
            res.json(patient);
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc Create a patient
// @route POST /api/patient
router.post('/', async (req, res) => {
    const { patient_name, age, room_number, diagnosis } = req.body;
    try {
        const patient = new Patient({
            patient_name,
            age,
            room_number,
            diagnosis
        });
        const createdPatient = await patient.save();
        res.status(201).json(createdPatient);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc Update patient vitals and score
// @route PUT /api/patient/:id
router.put('/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (patient) {
            patient.heart_rate = req.body.heart_rate !== undefined ? req.body.heart_rate : patient.heart_rate;
            patient.spo2 = req.body.spo2 !== undefined ? req.body.spo2 : patient.spo2;
            patient.temperature = req.body.temperature !== undefined ? req.body.temperature : patient.temperature;
            patient.respiratory_rate = req.body.respiratory_rate !== undefined ? req.body.respiratory_rate : patient.respiratory_rate;
            patient.blood_pressure = req.body.blood_pressure !== undefined ? req.body.blood_pressure : patient.blood_pressure;
            patient.movement_state = req.body.movement_state !== undefined ? req.body.movement_state : patient.movement_state;
            patient.risk_score = req.body.risk_score !== undefined ? req.body.risk_score : patient.risk_score;
            patient.status = req.body.status !== undefined ? req.body.status : patient.status;
            patient.updatedAt = Date.now();

            const updatedPatient = await patient.save();
            res.json(updatedPatient);
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
