const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patient_name: { type: String, required: true },
    age: { type: Number, required: true },
    room_number: { type: String, required: true },
    diagnosis: { type: String, default: 'General Observation' },
    heart_rate: { type: Number, default: 75 },
    spo2: { type: Number, default: 98 },
    temperature: { type: Number, default: 36.8 },
    respiratory_rate: { type: Number, default: 16 },
    blood_pressure: { type: String, default: '120/80' },
    movement_state: { type: String, default: 'Resting' },
    risk_score: { type: Number, default: 0 },
    status: { type: String, enum: ['Stable', 'Observation Needed', 'Nurse Alert', 'Emergency'], default: 'Stable' },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);
