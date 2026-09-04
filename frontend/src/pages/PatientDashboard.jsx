import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import socket from '../socket';

const FRAME_RATE = 15;
const EMIT_INTERVAL_MS = 1000;
const EYE_CLOSED_THRESHOLD = 0.07; // EAR threshold for closed eyes

const PatientDashboard = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const faceMeshRef = useRef(null);
    const prevNoseRef = useRef(null);
    const movementAccumulatorRef = useRef(0);
    const peerConnections = useRef({});
    const measurementsRef = useRef({ eyeOpeningRatio: 0.25, yawAngle: 0, faceCount: 0, painScore: 0, asymmetryScore: 0, marScore: 0 });
    const prevYawRef = useRef(0);
    const deliriumAccumulatorRef = useRef(0);
    const maxEyeHeightRef = useRef(0);

    // WebRTC Configuration
    const rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    };

    // Dynamic state variables for live vitals
    const [vitals, setVitals] = useState({
        heartRate: '-',
        spo2: '-',
        temperature: '-',
        respiratoryRate: '-',
        bloodPressure: '-'
    });

    // Control parameters for simulation overrides
    const [simulationMode, setSimulationMode] = useState('Stable'); // Stable, Tachycardia, Hypoxia, OutOfBed, Collapse, Restless, Sleep
    const [eyesClosedCounter, setEyesClosedCounter] = useState(0);
    const [eyesOpenedCounter, setEyesOpenedCounter] = useState(0);
    const [inactivityCounter, setInactivityCounter] = useState(0);

    const [displayData, setDisplayData] = useState({
        faceCount: 0,
        eyeOpeningRatio: 0.25,
        yawAngle: 0,
        eyesClosedSec: 0,
        eyesOpenedSec: 0,
        movementState: 'Resting',
        motionScore: 0,
        bedOccupancy: true,
        riskScore: 0,
        status: 'Stable'
    });

    const user = JSON.parse(localStorage.getItem('user'));
    const patientInfo = user?.patientInfo || {};

    // 1. Calculate Eye Opening Ratio (average EAR approximation)
    const calculateEyeOpening = useCallback((landmarks) => {
        const leftHeight = Math.abs(landmarks[159].y - landmarks[145].y);
        const rightHeight = Math.abs(landmarks[386].y - landmarks[374].y);
        const avgHeight = (leftHeight + rightHeight) / 2;

        const eyeWidth = Math.abs(landmarks[263].x - landmarks[33].x);
        if (eyeWidth === 0) return 0.25;

        return avgHeight / eyeWidth;
    }, []);

    // 2a. Calculate Pain (Eyebrow furrow + Grimace)
    const calculatePain = useCallback((landmarks) => {
        const eyebrowDist = Math.abs(landmarks[107].x - landmarks[336].x);
        const faceWidth = Math.abs(landmarks[234].x - landmarks[454].x);
        if (faceWidth === 0) return 0;
        const normalizedEyebrowDist = eyebrowDist / faceWidth;
        
        const mouthWidth = Math.abs(landmarks[61].x - landmarks[291].x);
        const normalizedMouthWidth = mouthWidth / faceWidth;
        
        let pain = 0;
        if (normalizedEyebrowDist < 0.12) pain += 10;
        if (normalizedMouthWidth > 0.40) pain += 10;
        return pain;
    }, []);

    // 2b. Calculate Asymmetry (Stroke)
    const calculateAsymmetry = useCallback((landmarks) => {
        const leftDrop = Math.abs(landmarks[61].y - landmarks[1].y);
        const rightDrop = Math.abs(landmarks[291].y - landmarks[1].y);
        const asymmetry = Math.abs(leftDrop - rightDrop);
        const faceHeight = Math.abs(landmarks[10].y - landmarks[152].y);
        if (faceHeight === 0) return 0;
        
        const normalizedAsymmetry = asymmetry / faceHeight;
        return normalizedAsymmetry > 0.05 ? 30 : 0;
    }, []);

    // 2c. Calculate MAR (Airway Distress / Yawning)
    const calculateMAR = useCallback((landmarks) => {
        const mouthHeight = Math.abs(landmarks[13].y - landmarks[14].y);
        const mouthWidth = Math.abs(landmarks[61].x - landmarks[291].x);
        if (mouthWidth === 0) return 0;
        return mouthHeight / mouthWidth;
    }, []);

    // 2. Calculate Head Yaw angle
    const calculateYaw = useCallback((landmarks) => {
        const noseTip = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const eyeWidth = Math.abs(rightEye.x - leftEye.x);

        if (eyeWidth === 0) return 0;

        const offset = noseTip.x - eyeCenterX;
        const normalizedOffset = offset / eyeWidth;
        return normalizedOffset * 90;
    }, []);

    // 3. Process FaceMesh results
    const onFaceMeshResults = useCallback((results) => {
        if (simulationMode === 'OutOfBed') return; // Skip camera processing if out-of-bed is forced

        const faces = results.multiFaceLandmarks || [];
        const faceCount = faces.length;
        let eyeOpening = 0.25;
        let yawAngle = 0;
        let painScore = 0;
        let asymmetryScore = 0;
        let marScore = 0;

        if (faceCount > 0) {
            const landmarks = faces[0];
            eyeOpening = calculateEyeOpening(landmarks);
            yawAngle = calculateYaw(landmarks);
            painScore = calculatePain(landmarks);
            asymmetryScore = calculateAsymmetry(landmarks);
            marScore = calculateMAR(landmarks);

            // Accumulate head displacement for restlessness tracking
            const currentNose = landmarks[1];
            if (prevNoseRef.current) {
                const dist = Math.sqrt(
                    Math.pow(currentNose.x - prevNoseRef.current.x, 2) +
                    Math.pow(currentNose.y - prevNoseRef.current.y, 2)
                );
                movementAccumulatorRef.current += dist;
            }
            prevNoseRef.current = { x: currentNose.x, y: currentNose.y };
        } else {
            prevNoseRef.current = null;
        }

        measurementsRef.current = {
            eyeOpeningRatio: eyeOpening,
            yawAngle,
            faceCount,
            painScore,
            asymmetryScore,
            marScore
        };

        // Draw video frame to canvas to compress & send
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            if (faceCount > 0) {
                const landmarks = faces[0];
                const pt = (index) => ({
                    x: landmarks[index].x * canvas.width,
                    y: landmarks[index].y * canvas.height
                });

                const drawPoint = (index, color) => {
                    const p = pt(index);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                };

                const drawLine = (i1, i2, color) => {
                    const p1 = pt(i1);
                    const p2 = pt(i2);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                };

                // Left eye (landmarks 159 top, 145 bottom)
                drawPoint(159, '#00f2fe');
                drawPoint(145, '#00f2fe');
                drawLine(159, 145, '#00f2fe');

                // Right eye (landmarks 386 top, 374 bottom)
                drawPoint(386, '#00f2fe');
                drawPoint(374, '#00f2fe');
                drawLine(386, 374, '#00f2fe');

                const leftHeightPx = Math.abs(landmarks[159].y - landmarks[145].y) * canvas.height;
                const rightHeightPx = Math.abs(landmarks[386].y - landmarks[374].y) * canvas.height;
                const avgHeightPx = (leftHeightPx + rightHeightPx) / 2;

                if (avgHeightPx > maxEyeHeightRef.current) {
                    maxEyeHeightRef.current = avgHeightPx;
                }

                console.log(`Opened Height: ${avgHeightPx.toFixed(1)}px, Max Height: ${maxEyeHeightRef.current.toFixed(1)}px`);
            }
        }
    }, [calculateEyeOpening, calculateYaw, calculatePain, calculateAsymmetry, calculateMAR, simulationMode]);

    // 4. Connect Sockets, initialize FaceMesh & Camera
    useEffect(() => {
        socket.connect();
        socket.emit('patient-join', {
            patientId: patientInfo._id,
            name: user.name,
            age: patientInfo.age || 65,
            roomNumber: patientInfo.room_number || 'ICU-102',
            diagnosis: patientInfo.diagnosis || 'Post-operative Recovery'
        });

        socket.on('set-simulation-mode', (data) => {
            const currentRoom = patientInfo.room_number || 'ICU-102';
            if (data.room === currentRoom) {
                setSimulationMode(data.mode);
            }
        });

        socket.on('sensor-data', (data) => {
            const currentRoom = patientInfo.room_number || 'ICU-102';
            if (data.room === currentRoom) {
                setVitals({
                    heartRate: data.heart_rate,
                    spo2: data.spO2,
                    temperature: data.temp,
                    respiratoryRate: data.resp_rate,
                    bloodPressure: data.ABP
                });
            }
        });

        socket.on('update-patients', (patients) => {
            const myData = patients[socket.id] || Object.values(patients).find(p => p.patientId === patientInfo._id);
            if (myData) {
                setDisplayData(prev => ({
                    ...prev,
                    riskScore: myData.riskScore,
                    status: myData.status
                }));
            }
        });

        const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onFaceMeshResults);
        faceMeshRef.current = faceMesh;

        if (videoRef.current) {
            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (faceMeshRef.current && videoRef.current && simulationMode !== 'OutOfBed') {
                        try {
                            await faceMeshRef.current.send({ image: videoRef.current });
                        } catch (err) {
                            console.log('Mediapipe frame execution error');
                        }
                    }
                },
                width: 320,
                height: 240,
                facingMode: 'user',
                frameRate: FRAME_RATE,
            });
            camera.start();
            cameraRef.current = camera;
        }

        return () => {
            if (cameraRef.current) cameraRef.current.stop();
            if (faceMeshRef.current) faceMeshRef.current.close();
            socket.off('set-simulation-mode');
            socket.off('sensor-data');
            socket.off('viewer-join');
            socket.off('webrtc-answer');
            socket.off('webrtc-ice-candidate');
            Object.values(peerConnections.current).forEach(pc => pc.close());
            socket.disconnect();
        };
    }, [onFaceMeshResults, user.name, patientInfo._id, patientInfo.room_number]);

    // WebRTC Signaling Handlers
    useEffect(() => {
        const createPeerConnection = (viewerId) => {
            const pc = new RTCPeerConnection(rtcConfig);
            peerConnections.current[viewerId] = pc;

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('webrtc-ice-candidate', {
                        targetId: viewerId,
                        candidate: event.candidate
                    });
                }
            };

            // Add video track if available (prefer raw video feed for performance)
            const stream = videoRef.current?.srcObject || (canvasRef.current ? canvasRef.current.captureStream(15) : null);
            if (stream) {
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
            }

            return pc;
        };

        socket.on('viewer-join', async ({ viewerId }) => {
            const pc = createPeerConnection(viewerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc-offer', {
                targetId: viewerId,
                sdp: pc.localDescription
            });
        });

        socket.on('webrtc-answer', async ({ sdp, senderId }) => {
            const pc = peerConnections.current[senderId];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            }
        });

        socket.on('webrtc-ice-candidate', async ({ candidate, senderId }) => {
            const pc = peerConnections.current[senderId];
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

    }, []);

    // 5. Receive Vitals (via socket) + Run Emergency Analytics Loop
    useEffect(() => {
        const telemetryTimer = setInterval(() => {
            // A. Vitals are now updated via the 'sensor-data' socket event.

            let faceCount = simulationMode === 'OutOfBed' ? 0 : measurementsRef.current.faceCount;
            let eyeOpeningRatio = faceCount > 0 ? measurementsRef.current.eyeOpeningRatio : 0;
            let yawAngle = faceCount > 0 ? measurementsRef.current.yawAngle : 0;
            let bedOccupancy = simulationMode !== 'OutOfBed' && faceCount > 0;
            let headPosition = 'Normal';
            
            let painScore = faceCount > 0 ? measurementsRef.current.painScore : 0;
            let asymmetryScore = faceCount > 0 ? measurementsRef.current.asymmetryScore : 0;
            let marScore = faceCount > 0 ? measurementsRef.current.marScore : 0;

            let deliriumScore = 0;
            if (faceCount > 0) {
                const yawDiff = Math.abs(yawAngle - prevYawRef.current);
                if (yawDiff > 15) {
                    deliriumAccumulatorRef.current += 5;
                } else {
                    deliriumAccumulatorRef.current = Math.max(0, deliriumAccumulatorRef.current - 1);
                }
                prevYawRef.current = yawAngle;
                deliriumScore = Math.min(20, deliriumAccumulatorRef.current);
            } else {
                deliriumAccumulatorRef.current = 0;
            }

            if (simulationMode !== 'OutOfBed') {
                if (simulationMode === 'Collapse') {
                    headPosition = 'Collapsed';
                    eyeOpeningRatio = 0.05; // Closed eyes
                } else if (simulationMode === 'Sleep') {
                    headPosition = 'Normal';
                    eyeOpeningRatio = 0.04; // Closed eyes
                }
            }

            // Accumulate eye closed timer
            let newEyesClosedSec = 0;
            let newEyesOpenedSec = 0;
            if (faceCount === 0) {
                setEyesClosedCounter(0);
                setEyesOpenedCounter(0);
            } else if (eyeOpeningRatio < EYE_CLOSED_THRESHOLD || simulationMode === 'Sleep' || simulationMode === 'Collapse') {
                newEyesClosedSec = eyesClosedCounter + 1;
                setEyesClosedCounter(newEyesClosedSec);
                setEyesOpenedCounter(0);
            } else {
                newEyesOpenedSec = eyesOpenedCounter + 1;
                setEyesOpenedCounter(newEyesOpenedSec);
                setEyesClosedCounter(0);
            }

            // Evaluate movement state
            let movementState = 'Resting';
            let rawMovementScore = movementAccumulatorRef.current * 1000;
            movementAccumulatorRef.current = 0; // reset accumulator
            
            let mappedMotionScore = 0;

            if (faceCount === 0) {
                movementState = 'NA';
                mappedMotionScore = 0;
                setInactivityCounter(0);
            } else if (simulationMode === 'Restless') {
                movementState = 'Restless';
                mappedMotionScore = 25;
                setInactivityCounter(0);
            } else if (simulationMode === 'Collapse' || simulationMode === 'Sleep') {
                movementState = 'Resting';
                mappedMotionScore = 5;
                setInactivityCounter(0);
            } else {
                mappedMotionScore = Math.min(30, Math.floor(rawMovementScore / 10));
                if (mappedMotionScore >= 21) {
                    movementState = 'Restless';
                    setInactivityCounter(0);
                } else if (mappedMotionScore >= 11) {
                    movementState = 'Active';
                    setInactivityCounter(0);
                } else {
                    mappedMotionScore = Math.max(1, mappedMotionScore);
                    const nextInactivity = inactivityCounter + 1;
                    if (rawMovementScore < 1.0) {
                        setInactivityCounter(nextInactivity);
                        if (nextInactivity >= 10) {
                            movementState = 'Unusual Inactivity';
                            mappedMotionScore = 0;
                        } else {
                            movementState = 'Resting';
                        }
                    } else {
                        setInactivityCounter(0);
                        movementState = 'Resting';
                    }
                }
            }

            // C. Base64 Web Video Capture Frame -> Now using WebRTC, just signal boolean
            let hasVideo = false;
            if (canvasRef.current && simulationMode !== 'OutOfBed') {
                hasVideo = true;
            }

            // Emit telemetry state to server
            const packet = {
                heartRate: vitals.heartRate,
                spo2: vitals.spo2,
                temperature: vitals.temperature,
                respiratoryRate: vitals.respiratoryRate,
                bloodPressure: vitals.bloodPressure,
                movementState,
                bedOccupancy,
                headPosition,
                eyesClosedSec: newEyesClosedSec,
                eyesOpenSec: newEyesOpenedSec, // added eyesOpenSec
                painScore,
                asymmetryScore,
                marScore,
                deliriumScore,
                videoFrame: hasVideo
            };

            socket.emit('update-patient-state', packet);

            setDisplayData(prev => ({
                ...prev,
                faceCount,
                eyeOpeningRatio: parseFloat(eyeOpeningRatio.toFixed(3)),
                yawAngle: Math.floor(yawAngle),
                eyesClosedSec: newEyesClosedSec,
                eyesOpenedSec: newEyesOpenedSec,
                movementState,
                motionScore: mappedMotionScore,
                bedOccupancy,
                painScore,
                asymmetryScore,
                marScore,
                deliriumScore
            }));

        }, EMIT_INTERVAL_MS);

        return () => clearInterval(telemetryTimer);
    }, [simulationMode, vitals, eyesClosedCounter, eyesOpenedCounter, inactivityCounter]);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'Stable':
                return { color: '#00f2fe', bg: 'rgba(0, 242, 254, 0.05)', border: 'rgba(0, 242, 254, 0.3)' };
            case 'Observation Needed':
                return { color: '#ffb300', bg: 'rgba(255, 179, 0, 0.05)', border: 'rgba(255, 179, 0, 0.3)' };
            case 'Nurse Alert':
                return { color: '#ff9100', bg: 'rgba(255, 145, 0, 0.08)', border: 'rgba(255, 145, 0, 0.4)' };
            case 'Emergency':
                return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', pulse: true };
            default:
                return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.2)' };
        }
    };

    const statusConfig = getStatusConfig(displayData.status);

    return (
        <div style={{
            backgroundColor: '#070a13',
            minHeight: '100vh',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            color: '#f1f5f9',
            padding: '24px'
        }}>
            {/* Top Navigation */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: '16px',
                marginBottom: '28px'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        🏥 Patient Monitoring Room
                    </h1>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                        Vigilance ICU Telemetry Node · Patient ID: <strong style={{ color: '#00f2fe' }}>{patientInfo._id || 'MOCK'}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '6px 12px',
                        borderRadius: '10px'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 8px #10b981',
                            animation: 'pulse 1.5s infinite'
                        }} />
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#cbd5e1' }}>Telemetry Link Active</span>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/';
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* Layout Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                maxWidth: '1280px',
                margin: '0 auto'
            }}>
                {/* Column 1: Video and CV Telemetry */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Live Feed Container */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.45)',
                        border: `1px solid ${statusConfig.border}`,
                        borderRadius: '20px',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                        animation: statusConfig.pulse ? 'emergencyPulse 2s infinite' : 'none'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            left: '16px',
                            zIndex: 10,
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center'
                        }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: statusConfig.color,
                                boxShadow: `0 0 10px ${statusConfig.color}`,
                                animation: 'pulse 1s infinite'
                            }} />
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                color: statusConfig.color,
                                background: 'rgba(7, 10, 19, 0.85)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                letterSpacing: '0.5px'
                            }}>
                                ROOM FEED: {displayData.status}
                            </span>
                        </div>

                        {simulationMode === 'OutOfBed' ? (
                            <div style={{
                                height: '340px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#0a0d17',
                                color: '#ef4444',
                                gap: '12px'
                            }}>
                                <span style={{ fontSize: '48px' }}>⚠️</span>
                                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>BED EMPTY - NO PATIENT DETECTED</span>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Camera scanning aborted</span>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                style={{ display: 'none' }}
                                playsInline
                                muted
                            />
                        )}
                        <canvas 
                            ref={canvasRef} 
                            width={320} 
                            height={240} 
                            style={{ 
                                width: '100%',
                                height: '340px',
                                objectFit: 'cover',
                                display: simulationMode === 'OutOfBed' ? 'none' : 'block',
                                transform: 'scaleX(-1)' // Mirror view
                            }} 
                        />
                    </div>

                    {/* CV Telemetry Card */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.45)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '20px',
                        padding: '24px'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#cbd5e1' }}>
                            🧠 Computer Vision Telemetry
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                            <MetricCard label="Eyes Opening Ratio" value={displayData.eyeOpeningRatio} subText={displayData.eyeOpeningRatio < EYE_CLOSED_THRESHOLD ? "Eyes Closed" : "Eyes Open"} stateColor={displayData.eyeOpeningRatio < EYE_CLOSED_THRESHOLD ? "#f43f5e" : "#10b981"} />
                            <MetricCard label="Motion Assessment" value={displayData.movementState} subText={`Score: ${displayData.motionScore} / 30`} stateColor={displayData.movementState === 'Restless' ? "#f59e0b" : displayData.movementState === 'Unusual Inactivity' || displayData.movementState === 'NA' ? "#ef4444" : "#10b981"} />
                            <MetricCard label="Eye State Timer" value={displayData.eyeOpeningRatio < EYE_CLOSED_THRESHOLD ? `${displayData.eyesClosedSec}s` : `${displayData.eyesOpenedSec}s`} subText={displayData.eyeOpeningRatio < EYE_CLOSED_THRESHOLD ? "Time since eyes closed" : "Time since eyes opened"} stateColor="#10b981" />
                            <MetricCard label="Bed Occupancy Sensor" value={displayData.bedOccupancy ? "Occupied" : "Not Occupied"} subText="Presence tracking" stateColor={displayData.bedOccupancy ? "#10b981" : "#ef4444"} />
                            <MetricCard label="Pain Assessment" value={displayData.painScore > 0 ? "Distress" : "Comfortable"} subText={`Score: ${displayData.painScore}`} stateColor={displayData.painScore > 0 ? "#f59e0b" : "#10b981"} />
                            <MetricCard label="Neurological (Stroke)" value={displayData.asymmetryScore > 0 ? "Asymmetry" : "Normal"} subText={`Score: ${displayData.asymmetryScore}`} stateColor={displayData.asymmetryScore > 0 ? "#ef4444" : "#10b981"} />
                            <MetricCard label="Airway Distress (MAR)" value={displayData.marScore > 0.4 ? "Gasping/Yawn" : "Normal"} subText={displayData.marScore ? `Ratio: ${displayData.marScore.toFixed(2)}` : 'Ratio: 0'} stateColor={displayData.marScore > 0.4 ? "#f59e0b" : "#10b981"} />
                            <MetricCard label="Delirium Tracking" value={displayData.deliriumScore > 10 ? "Erratic" : "Calm"} subText={`Score: ${displayData.deliriumScore}`} stateColor={displayData.deliriumScore > 10 ? "#f59e0b" : "#10b981"} />
                        </div>
                    </div>
                </div>

                {/* Column 2: Patient Info and Vitals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Patient Information Header */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '20px',
                        padding: '24px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    color: '#00f2fe',
                                    background: 'rgba(0, 242, 254, 0.1)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    marginBottom: '10px'
                                }}>
                                    Room {patientInfo.room_number || 'ICU-102'}
                                </span>
                                <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 6px 0' }}>{user.name}</h2>
                                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                                    Age: <strong style={{ color: '#fff' }}>{patientInfo.age || 65} y/o</strong> · Diagnosis: <strong style={{ color: '#fff' }}>{patientInfo.diagnosis || 'Post-operative Observation'}</strong>
                                </p>
                            </div>
                            <div style={{
                                textAlign: 'right',
                                background: statusConfig.bg,
                                border: `1px solid ${statusConfig.border}`,
                                padding: '12px 18px',
                                borderRadius: '12px'
                            }}>
                                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Risk Score</p>
                                <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: statusConfig.color }}>
                                    {displayData.riskScore}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Vitals Telemetry */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.45)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '20px',
                        padding: '24px'
                    }}>
                        <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: '600', color: '#cbd5e1' }}>
                            📈 Real-time Vitals Telemetry
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                            <VitalCard
                                label="Heart Rate"
                                value={vitals.heartRate}
                                unit="bpm"
                                icon="❤️"
                                animate={vitals.heartRate > 100}
                                color={vitals.heartRate > 100 ? "#ef4444" : vitals.heartRate < 50 ? "#3b82f6" : "#00f2fe"}
                            />
                            <VitalCard
                                label="SpO2 Oxygen"
                                value={vitals.spo2}
                                unit="%"
                                icon="🫁"
                                animate={vitals.spo2 < 92}
                                color={vitals.spo2 < 92 ? "#ef4444" : vitals.spo2 < 95 ? "#f59e0b" : "#10b981"}
                            />
                            <VitalCard
                                label="Body Temperature"
                                value={`${vitals.temperature}`}
                                unit="°C"
                                icon="🌡️"
                                color={vitals.temperature > 37.8 ? "#f43f5e" : "#10b981"}
                            />
                            <VitalCard
                                label="Respiratory Rate"
                                value={vitals.respiratoryRate}
                                unit="rpm"
                                icon="💨"
                                color={vitals.respiratoryRate > 20 || vitals.respiratoryRate < 10 ? "#ef4444" : "#10b981"}
                            />
                        </div>
                        <div style={{
                            marginTop: '16px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Arterial Blood Pressure (ABP)</span>
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{vitals.bloodPressure} mmHg</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Animations in Style Tag */}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }
                @keyframes heartbeat {
                    0% { transform: scale(1); }
                    25% { transform: scale(1.15); }
                    40% { transform: scale(1); }
                    55% { transform: scale(1.15); }
                    70% { transform: scale(1); }
                }
                @keyframes emergencyPulse {
                    0% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 10px rgba(239, 68, 68, 0.1); }
                    50% { border-color: rgba(239, 68, 68, 1); box-shadow: 0 0 25px rgba(239, 68, 68, 0.4); }
                    100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 10px rgba(239, 68, 68, 0.1); }
                }
            `}</style>
        </div>
    );
};

// Component helper cards
const MetricCard = ({ label, value, subText, stateColor }) => (
    <div style={{
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
    }}>
        <span style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 6px 0' }}>{label}</span>
        <h4 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: stateColor }}>{value}</h4>
        <span style={{ fontSize: '11px', color: '#64748b' }}>{subText}</span>
    </div>
);

const VitalCard = ({ label, value, unit, icon, animate, color }) => (
    <div style={{
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        border: `1px solid ${animate ? color : 'rgba(255, 255, 255, 0.04)'}`,
        borderRadius: '16px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: animate ? `0 0 15px ${color}33` : 'none'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{label}</span>
            <span style={{
                fontSize: '20px',
                animation: animate ? 'heartbeat 0.8s infinite' : 'none',
                display: 'inline-block'
            }}>{icon}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>{value}</span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>{unit}</span>
        </div>
    </div>
);

const SimButton = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        style={{
            flex: '1 1 auto',
            background: active ? color : 'rgba(255, 255, 255, 0.04)',
            border: active ? `1px solid ${color}` : '1px solid rgba(255, 255, 255, 0.08)',
            color: active ? '#fff' : '#94a3b8',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: active ? `0 4px 12px ${color}33` : 'none',
            outline: 'none'
        }}
    >
        {label}
    </button>
);

export default PatientDashboard;
