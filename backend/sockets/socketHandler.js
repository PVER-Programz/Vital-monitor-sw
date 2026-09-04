const Patient = require('../models/Patient');
const Alert = require('../models/Alert');

const patientsCache = {};

let globalRiskSettings = {
    movement: { enabled: true, rested: 0, active: 5, restless: 15, unusualInactivity: 50, bedUnoccupied: 12 },
    vitals: {
        enabled: true,
        spo2: { threshold: 92, belowThresholdMax: 100, belowThresholdMin: 45, aboveThresholdMax: 45, aboveThresholdMin: 0 },
        heartRate: { lowerThreshold: 50, upperThreshold: 100, belowLowerMax: 40, belowLowerMin: 0, aboveUpperMin: 0, aboveUpperMax: 30 },
        temperature: { lowerThreshold: 35, upperThreshold: 37, belowLowerMax: 15, belowLowerMin: 0, aboveUpperMin: 0, aboveUpperMax: 35 }
    },
    fatigue: {
        enabled: true,
        eyeCloseThreshold: 0.07,
        rules: [
            { id: 1, type: 'eyes_open', condition: '>', seconds: 200, points: 20 },
            { id: 2, type: 'eyes_open', condition: '>', seconds: 100, points: 10 }
        ]
    },
    alerts: {
        level1: { enabled: true, threshold: 20 },
        level2: { enabled: true, threshold: 40 },
        level3: { enabled: true, threshold: 60 }
    }
};

const calculateRiskScore = (data) => {
    let movement_score = 0;
    let vital_anomaly_score = 0;
    let posture_score = 0;
    let fatigue_score = 0;
    
    // New Advanced CV Scores
    let pain_score = data.painScore || 0;
    let neurological_score = Math.max(data.asymmetryScore || 0, data.deliriumScore || 0);
    let respiratory_distress_score = (data.marScore && data.marScore > 0.4) ? 20 : 0;

    const settings = globalRiskSettings;

    // 1. Movement & Posture Score
    if (settings.movement.enabled) {
        if (data.movementState === 'High Restlessness' || data.movementState === 'Moderate Restlessness') {
            movement_score = settings.movement.restless;
        } else if (data.movementState === 'Unusual Inactivity') {
            movement_score = settings.movement.unusualInactivity;
        } else if (data.movementState === 'Active') {
            movement_score = settings.movement.active;
        } else if (data.movementState === 'Resting' || !data.movementState) {
            movement_score = settings.movement.rested;
        }

        if (data.bedOccupancy === false) {
            posture_score = settings.movement.bedUnoccupied;
        }
    } else {
        if (data.bedOccupancy === false) posture_score = 30;
    }
    
    if (data.headPosition === 'Collapsed') {
        posture_score = Math.max(posture_score, 30);
    } else if (data.headPosition === 'Abnormal Slump') {
        posture_score = Math.max(posture_score, 15);
    }

    // 2. Vital Anomaly Score
    if (settings.vitals.enabled) {
        if (data.spo2) {
            const th = settings.vitals.spo2.threshold;
            if (data.spo2 < th) {
                const ratio = Math.max(0, (th - data.spo2) / th); 
                vital_anomaly_score += settings.vitals.spo2.belowThresholdMin + ratio * (settings.vitals.spo2.belowThresholdMax - settings.vitals.spo2.belowThresholdMin);
            } else {
                const range = 100 - th;
                const ratio = range > 0 ? Math.max(0, (100 - data.spo2) / range) : 0;
                vital_anomaly_score += settings.vitals.spo2.aboveThresholdMin + ratio * (settings.vitals.spo2.aboveThresholdMax - settings.vitals.spo2.aboveThresholdMin);
            }
        }
        if (data.heartRate) {
            const lTh = settings.vitals.heartRate.lowerThreshold;
            const uTh = settings.vitals.heartRate.upperThreshold;
            if (data.heartRate < lTh) {
                const ratio = Math.max(0, (lTh - data.heartRate) / lTh);
                vital_anomaly_score += settings.vitals.heartRate.belowLowerMin + ratio * (settings.vitals.heartRate.belowLowerMax - settings.vitals.heartRate.belowLowerMin);
            } else if (data.heartRate > uTh) {
                const range = 220 - uTh;
                const ratio = range > 0 ? Math.min(1, (data.heartRate - uTh) / range) : 0;
                vital_anomaly_score += settings.vitals.heartRate.aboveUpperMin + ratio * (settings.vitals.heartRate.aboveUpperMax - settings.vitals.heartRate.aboveUpperMin);
            }
        }
        if (data.temperature) {
            const lTh = settings.vitals.temperature.lowerThreshold;
            const uTh = settings.vitals.temperature.upperThreshold;
            if (data.temperature < lTh) {
                const range = lTh - 30;
                const ratio = range > 0 ? Math.min(1, (lTh - data.temperature) / range) : 0;
                vital_anomaly_score += settings.vitals.temperature.belowLowerMin + ratio * (settings.vitals.temperature.belowLowerMax - settings.vitals.temperature.belowLowerMin);
            } else if (data.temperature > uTh) {
                const range = 40 - uTh;
                const ratio = range > 0 ? Math.min(1, (data.temperature - uTh) / range) : 0;
                vital_anomaly_score += settings.vitals.temperature.aboveUpperMin + ratio * (settings.vitals.temperature.aboveUpperMax - settings.vitals.temperature.aboveUpperMin);
            }
        }
    }

    // 3. Fatigue Score
    if (settings.fatigue.enabled) {
        let current_fatigue = 0;
        let matched = false;
        
        for (const rule of settings.fatigue.rules) {
            if (rule.type === 'eyes_closed' && rule.condition === '>' && data.eyesClosedSec > rule.seconds) {
                current_fatigue = Math.max(current_fatigue, rule.points);
                matched = true;
            } else if (rule.type === 'eyes_open' && rule.condition === '>' && data.eyesOpenSec > rule.seconds) {
                current_fatigue = Math.max(current_fatigue, rule.points);
                matched = true;
            }
        }
        
        if (!matched && data.eyesClosedSec) {
            if (data.eyesClosedSec > 5) fatigue_score = 20;
            else if (data.eyesClosedSec > 3) fatigue_score = 10;
        } else {
            fatigue_score = current_fatigue;
        }
    }

    const totalScore = Math.floor(Math.min(100, movement_score + vital_anomaly_score + posture_score + fatigue_score + pain_score + neurological_score + respiratory_distress_score));
    
    // Determine category status
    let status = 'Stable';
    if (settings.alerts.level3.enabled && totalScore > settings.alerts.level3.threshold) status = 'Emergency';
    else if (settings.alerts.level2.enabled && totalScore > settings.alerts.level2.threshold) status = 'Nurse Alert';
    else if (settings.alerts.level1.enabled && totalScore > settings.alerts.level1.threshold) status = 'Observation Needed';

    return {
        score: totalScore,
        status,
        components: { movement_score, vital_anomaly_score, posture_score, fatigue_score, pain_score, neurological_score, respiratory_distress_score }
    };
};

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`Socket client connected: ${socket.id}`);

        // Patient registering on the socket
        socket.on('patient-join', async (data) => {
            try {
                const name = data.name || 'Unknown Patient';
                let patientId = data.patientId;

                // Attempt to fetch from DB if ID is provided, otherwise query by name
                let patientDoc = null;
                try {
                    if (patientId) {
                        patientDoc = await Patient.findById(patientId);
                    } else {
                        patientDoc = await Patient.findOne({ patient_name: name }).sort({ updatedAt: -1 });
                    }
                } catch (err) {
                    console.log('Database read error, using cache fallback.');
                }

                if (!patientDoc) {
                    // Fallback local memory object ID
                    patientId = patientId || `mock_pat_${socket.id}`;
                    patientDoc = {
                        _id: patientId,
                        patient_name: name,
                        age: data.age || 65,
                        room_number: data.roomNumber || 'ICU-102',
                        diagnosis: data.diagnosis || 'Post-operative Observation',
                        heart_rate: '-',
                        spo2: '-',
                        temperature: '-',
                        respiratory_rate: '-',
                        blood_pressure: '-',
                        movement_state: 'Resting',
                        risk_score: 0,
                        status: 'Stable'
                    };
                } else {
                    patientId = patientDoc._id.toString();
                }

                // Add to active patient memory cache
                patientsCache[socket.id] = {
                    patientId: patientId,
                    name: patientDoc.patient_name,
                    age: patientDoc.age,
                    roomNumber: patientDoc.room_number,
                    diagnosis: patientDoc.diagnosis,
                    heartRate: patientDoc.heart_rate,
                    spo2: patientDoc.spo2,
                    temperature: patientDoc.temperature,
                    respiratoryRate: patientDoc.respiratory_rate,
                    bloodPressure: patientDoc.blood_pressure,
                    movementState: patientDoc.movement_state,
                    riskScore: patientDoc.risk_score,
                    status: patientDoc.status,
                    bedOccupancy: true,
                    headPosition: 'Normal',
                    eyesClosedSec: 0,
                    painScore: 0,
                    asymmetryScore: 0,
                    marScore: 0,
                    deliriumScore: 0,
                    lastAlertTime: {},
                    videoFrame: null,
                    timeline: [{
                        time: new Date().toLocaleTimeString(),
                        event: "ICU Monitoring Session Initiated",
                        severity: "Stable"
                    }]
                };

                console.log(`Patient connected: ${name} in Room ${patientDoc.room_number}`);
                
                // Broadcast updated list to all caretakers
                io.emit('update-patients', patientsCache);
            } catch (err) {
                console.error('Error on patient-join:', err);
            }
        });

        socket.on('update-risk-settings', (newSettings) => {
            console.log('Updating global risk settings');
            globalRiskSettings = newSettings;
            // Re-evaluate all patients
            Object.values(patientsCache).forEach(cache => {
                const evaluation = calculateRiskScore(cache);
                cache.riskScore = evaluation.score;
                cache.status = evaluation.status;
            });
            io.emit('update-patients', patientsCache);
            io.emit('risk-settings-updated', globalRiskSettings);
        });

        socket.on('get-risk-settings', () => {
            socket.emit('risk-settings-updated', globalRiskSettings);
        });

        // Patient telemetry updates (webcam analysis + mock vitals)
        socket.on('update-patient-state', async (data) => {
            const cache = patientsCache[socket.id];
            if (!cache) return;

            // Update parameters in cache
            cache.heartRate = data.heartRate !== undefined ? data.heartRate : cache.heartRate;
            cache.spo2 = data.spo2 !== undefined ? data.spo2 : cache.spo2;
            cache.temperature = data.temperature !== undefined ? data.temperature : cache.temperature;
            cache.respiratoryRate = data.respiratoryRate !== undefined ? data.respiratoryRate : cache.respiratoryRate;
            cache.bloodPressure = data.bloodPressure !== undefined ? data.bloodPressure : cache.bloodPressure;
            cache.movementState = data.movementState !== undefined ? data.movementState : cache.movementState;
            cache.bedOccupancy = data.bedOccupancy !== undefined ? data.bedOccupancy : cache.bedOccupancy;
            cache.headPosition = data.headPosition !== undefined ? data.headPosition : cache.headPosition;
            cache.eyesClosedSec = data.eyesClosedSec !== undefined ? data.eyesClosedSec : cache.eyesClosedSec;
            cache.eyesOpenSec = data.eyesOpenSec !== undefined ? data.eyesOpenSec : (cache.eyesOpenSec || 0);
            cache.painScore = data.painScore !== undefined ? data.painScore : cache.painScore;
            cache.asymmetryScore = data.asymmetryScore !== undefined ? data.asymmetryScore : cache.asymmetryScore;
            cache.marScore = data.marScore !== undefined ? data.marScore : cache.marScore;
            cache.deliriumScore = data.deliriumScore !== undefined ? data.deliriumScore : cache.deliriumScore;
            cache.videoFrame = data.videoFrame !== undefined ? data.videoFrame : cache.videoFrame; // Live video feed

            // Evaluate Risk Score
            const evaluation = calculateRiskScore(cache);
            cache.riskScore = evaluation.score;
            cache.status = evaluation.status;

            // Emergency Engine: Evaluate alerts to trigger
            const now = Date.now();
            const alertThrottleMs = 10000; // 10s cooldown for identical alerts

            const triggerAlert = async (alertType, severity, message) => {
                const lastTime = cache.lastAlertTime[alertType] || 0;
                if (now - lastTime < alertThrottleMs) return; // Throttled

                cache.lastAlertTime[alertType] = now;
                const timeString = new Date().toLocaleTimeString();

                // Add to timeline
                cache.timeline.unshift({
                    time: timeString,
                    event: `${alertType}: ${message}`,
                    severity
                });

                // Limit timeline items to 20
                if (cache.timeline.length > 20) cache.timeline.pop();

                // Save alert to database
                try {
                    if (cache.patientId && !cache.patientId.startsWith('mock_')) {
                        await Alert.create({
                            patient_id: cache.patientId,
                            patient_name: cache.name,
                            alert_type: alertType,
                            severity: severity,
                            message: message
                        });
                    }
                } catch (dbErr) {
                    console.log("DB save alert skipped/failed.");
                }

                // Broadcast immediate alert notification
                io.emit('emergency-notification', {
                    patientId: cache.patientId,
                    patientName: cache.name,
                    roomNumber: cache.roomNumber,
                    alertType,
                    severity,
                    message,
                    timestamp: timeString
                });
            };

            // Emergency detection conditions based on configurable levels
            if (cache.status === 'Emergency' && globalRiskSettings.alerts.level3.enabled) {
                await triggerAlert('Level-3 Emergency', 'Emergency', `Critical: Risk score (${cache.riskScore}) exceeded Level-3 threshold.`);
            } else if (cache.status === 'Nurse Alert' && globalRiskSettings.alerts.level2.enabled) {
                await triggerAlert('Level-2 Warning', 'Nurse Alert', `Warning: Risk score (${cache.riskScore}) exceeded Level-2 threshold.`);
            } else if (cache.status === 'Observation Needed' && globalRiskSettings.alerts.level1.enabled) {
                await triggerAlert('Level-1 Notice', 'Observation Needed', `Notice: Risk score (${cache.riskScore}) exceeded Level-1 threshold.`);
            }

            // Sync database Patient record asynchronously
            try {
                if (cache.patientId && !cache.patientId.startsWith('mock_')) {
                    await Patient.findByIdAndUpdate(cache.patientId, {
                        heart_rate: cache.heartRate,
                        spo2: cache.spo2,
                        temperature: cache.temperature,
                        respiratory_rate: cache.respiratoryRate,
                        blood_pressure: cache.bloodPressure,
                        movement_state: cache.movementState,
                        risk_score: cache.riskScore,
                        status: cache.status,
                        updatedAt: new Date()
                    });
                }
            } catch (dbErr) {
                // Ignore DB update failures
            }

            // Push state updates to all caretakers
            io.emit('update-patients', patientsCache);
        });

        // WebRTC Signaling
        socket.on('request-video', (data) => {
            if (data.targetId) {
                io.to(data.targetId).emit('viewer-join', { viewerId: socket.id });
            }
        });

        socket.on('webrtc-offer', (data) => {
            io.to(data.targetId).emit('webrtc-offer', {
                sdp: data.sdp,
                senderId: socket.id
            });
        });

        socket.on('webrtc-answer', (data) => {
            io.to(data.targetId).emit('webrtc-answer', {
                sdp: data.sdp,
                senderId: socket.id
            });
        });

        socket.on('webrtc-ice-candidate', (data) => {
            io.to(data.targetId).emit('webrtc-ice-candidate', {
                candidate: data.candidate,
                senderId: socket.id
            });
        });

        // Client disconnected
        socket.on('disconnect', () => {
            const cache = patientsCache[socket.id];
            if (cache) {
                console.log(`Patient disconnected: ${cache.name}`);
                delete patientsCache[socket.id];
                io.emit('update-patients', patientsCache);
            }
        });
    });
};

module.exports = socketHandler;
