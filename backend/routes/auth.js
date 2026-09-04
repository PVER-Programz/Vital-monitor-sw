const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Patient = require('../models/Patient');
const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'vigilance_secret_key_123', { expiresIn: '30d' });
};

// @desc Register patient/caretaker
// @route POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password, role, age, room_number, diagnosis } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Account already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role === 'student' ? 'patient' : role === 'proctor' ? 'caretaker' : role
        });

        if (user) {
            let patient = null;
            if (user.role === 'patient') {
                patient = await Patient.create({
                    patient_name: name,
                    age: age || Math.floor(Math.random() * 50) + 30,
                    room_number: room_number || `ICU-${Math.floor(Math.random() * 10) + 101}`,
                    diagnosis: diagnosis || 'Post-operative Recovery',
                    user_id: user._id,
                    heart_rate: 75,
                    spo2: 98,
                    temperature: 36.8,
                    status: 'Stable',
                    movement_state: 'Resting'
                });
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                patientInfo: patient,
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @desc Login patient/caretaker
// @route POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            let patient = null;
            if (user.role === 'patient') {
                patient = await Patient.findOne({ user_id: user._id });
                // If patient document wasn't created, create one on the fly
                if (!patient) {
                    patient = await Patient.create({
                        patient_name: user.name,
                        age: Math.floor(Math.random() * 50) + 30,
                        room_number: `ICU-${Math.floor(Math.random() * 10) + 101}`,
                        diagnosis: 'Observation',
                        user_id: user._id
                    });
                }
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                patientInfo: patient,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
