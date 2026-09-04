const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @desc Get list of active caretakers (for routing / reference)
// @route GET /api/caretaker
router.get('/', async (req, res) => {
    try {
        const caretakers = await User.find({ role: 'caretaker' }).select('-password');
        res.json(caretakers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
