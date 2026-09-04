const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    patient_name: { type: String, required: true },
    alert_type: { type: String, required: true }, // e.g. SpO2 Drop, Sudden Collapse, etc.
    severity: { type: String, enum: ['Stable', 'Observation Needed', 'Nurse Alert', 'Emergency'], default: 'Observation Needed' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
