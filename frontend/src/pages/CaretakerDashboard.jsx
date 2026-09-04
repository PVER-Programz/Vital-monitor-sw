import React, { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import RiskSettingsModal from '../components/RiskSettingsModal';

const CaretakerDashboard = () => {
    const [patients, setPatients] = useState({});
    const [selectedId, setSelectedId] = useState(null);
    const [notifications, setNotifications] = useState([]);
    
    // Risk Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [riskSettings, setRiskSettings] = useState(null);
    
    // Rolling vitals history for the active charts
    const [hrHistory, setHrHistory] = useState([]);
    const [spo2History, setSpo2History] = useState([]);
    const prevVitalsRef = useRef({ hr: 0, spo2: 0 });
    
    const remoteVideoRef = useRef(null);
    const rtcConnectionRef = useRef(null);

    // WebRTC Configuration
    const rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    };

    useEffect(() => {
        socket.connect();

        // Listen for real-time patient telemetry sync
        socket.on('update-patients', (data) => {
            setPatients({ ...data });

            // Automatically select the first patient if none selected
            const ids = Object.keys(data);
            if (ids.length > 0 && !selectedId) {
                // Find socket ID
                setSelectedId(ids[0]);
            }
        });

        // Listen for emergency clinical warnings
        socket.on('emergency-notification', (notif) => {
            if (notif.severity === 'Observation Needed') return; // Level 1 is just grid highlight
            
            const id = Date.now() + Math.random().toString();
            const newNotif = { ...notif, id };

            setNotifications((prev) => [newNotif, ...prev]);
            
            let timeoutMs = 2000; // Level 2 default
            if (notif.severity === 'Emergency') {
                timeoutMs = 5000; // Level 3
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    osc.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.5);
                } catch(e) {}
            }

            // Auto dismiss
            setTimeout(() => {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
            }, timeoutMs);
        });

        // Listen for risk settings changes
        socket.on('risk-settings-updated', (settings) => {
            setRiskSettings(settings);
        });

        // Request initial risk settings
        socket.emit('get-risk-settings');

        return () => {
            socket.off('update-patients');
            socket.off('emergency-notification');
            socket.disconnect();
        };
    }, [selectedId]);

    // Update rolling waveform history for the selected patient
    useEffect(() => {
        if (!selectedId || !patients[selectedId]) return;

        const currentPatient = patients[selectedId];
        let newHr = parseInt(currentPatient.heartRate);
        if (isNaN(newHr)) newHr = 70;

        let newSpo2 = parseInt(currentPatient.spo2);
        if (isNaN(newSpo2)) newSpo2 = 98;

        // Update history only when vitals change or periodically
        if (newHr !== prevVitalsRef.current.hr || newSpo2 !== prevVitalsRef.current.spo2) {
            prevVitalsRef.current = { hr: newHr, spo2: newSpo2 };

            setHrHistory((prev) => {
                const next = [...prev, newHr];
                if (next.length > 25) next.shift();
                return next;
            });

            setSpo2History((prev) => {
                const next = [...prev, newSpo2];
                if (next.length > 25) next.shift();
                return next;
            });
        }
    }, [patients, selectedId]);

    // Reset charts history when changing patients
    const handleSelectPatient = (id) => {
        setSelectedId(id);
        setHrHistory([]);
        setSpo2History([]);
        prevVitalsRef.current = { hr: 0, spo2: 0 };
    };

    // Initialize WebRTC when selectedId changes
    useEffect(() => {
        if (!selectedId) return;

        if (rtcConnectionRef.current) {
            rtcConnectionRef.current.close();
            rtcConnectionRef.current = null;
        }

        const pc = new RTCPeerConnection(rtcConfig);
        rtcConnectionRef.current = pc;

        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    targetId: selectedId,
                    candidate: event.candidate
                });
            }
        };

        // Request video from selected patient
        socket.emit('request-video', { targetId: selectedId });

        return () => {
            if (rtcConnectionRef.current) {
                rtcConnectionRef.current.close();
                rtcConnectionRef.current = null;
            }
        };
    }, [selectedId]);

    useEffect(() => {
        const handleOffer = async ({ sdp, senderId }) => {
            if (senderId !== selectedId || !rtcConnectionRef.current) return;
            const pc = rtcConnectionRef.current;
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-answer', {
                targetId: senderId,
                sdp: pc.localDescription
            });
        };

        const handleIceCandidate = async ({ candidate, senderId }) => {
            if (senderId !== selectedId || !rtcConnectionRef.current) return;
            try {
                await rtcConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ice candidate', e);
            }
        };

        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);

        return () => {
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
        };
    }, [selectedId]);

    const activePatient = selectedId ? patients[selectedId] : null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'Stable': return '#00f2fe';
            case 'Observation Needed': return '#ffb300';
            case 'Nurse Alert': return '#f97316';
            case 'Emergency': return '#ef4444';
            default: return '#10b981';
        }
    };

    return (
        <div style={{
            backgroundColor: '#070a13',
            minHeight: '100vh',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            color: '#f1f5f9',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            {/* Top Navigation Bar */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: '16px',
                marginBottom: '20px'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        🏨 ICU Caretaker Monitoring Dashboard
                    </h1>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                        Clinical Telemetry Control Center · Active Rooms: <strong style={{ color: '#00f2fe' }}>{Object.keys(patients).length}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ⚙️ Settings
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/';
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* Notification Banners Wrapper */}
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '380px'
            }}>
                {notifications.map((n) => (
                    <div key={n.id} style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '2px solid #ef4444',
                        boxShadow: '0 10px 30px rgba(239, 68, 68, 0.35)',
                        borderRadius: '16px',
                        padding: '16px',
                        color: '#fff',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        animation: 'slideIn 0.3s ease-out',
                        position: 'relative'
                    }}>
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            color: '#ef4444',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>⚠️</div>
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#ef4444' }}>
                                EMERGENCY ALERT: {n.roomNumber}
                            </h4>
                            <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '500' }}>
                                Patient: <strong>{n.patientName}</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>
                                {n.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setNotifications((prev) => prev.filter((item) => item.id !== n.id))}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                fontSize: '16px',
                                cursor: 'pointer',
                                padding: 0
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {/* Main Application Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: '20px',
                height: 'calc(100vh - 110px)',
                overflow: 'hidden'
            }}>
                {/* Left Panel: Active Patients List */}
                <div style={{
                    background: 'rgba(30, 41, 59, 0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '20px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Patients Grid
                    </h3>

                    {Object.keys(patients).length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#64748b',
                            fontSize: '13px'
                        }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📡</div>
                            Waiting for monitored ICU rooms to connect...
                        </div>
                    ) : (
                        Object.entries(patients).map(([id, data]) => {
                            const isSelected = selectedId === id;
                            const color = getStatusColor(data.status);
                            return (
                                <div
                                    key={id}
                                    onClick={() => handleSelectPatient(id)}
                                    style={{
                                        padding: '14px',
                                        borderRadius: '16px',
                                        border: isSelected ? `2px solid ${color}` : '1.5px solid rgba(255,255,255,0.06)',
                                        background: isSelected ? 'rgba(30, 41, 59, 0.5)' : 'rgba(15, 23, 42, 0.45)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: isSelected ? `0 0 15px ${color}1c` : 'none',
                                        animation: data.status === 'Emergency' ? 'flashingRedBorder 1.5s infinite' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>
                                            {data.roomNumber}
                                        </span>
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: color,
                                            background: `${color}15`,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            textTransform: 'uppercase'
                                        }}>
                                            {data.status}
                                        </span>
                                    </div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold' }}>
                                        {data.name}
                                    </h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                                            <span>❤️ {data.heartRate || '--'}</span>
                                            <span>🫁 {data.spo2 || '--'}%</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Risk Score</span>
                                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: color }}>
                                                {data.riskScore}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Panel: Detailed Active Patient Inspection View */}
                {activePatient ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateRows: 'auto 1fr',
                        gap: '16px',
                        overflow: 'hidden'
                    }}>
                        {/* Selected Patient Clinical Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '20px',
                            padding: '16px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    color: '#00f2fe',
                                    background: 'rgba(0, 242, 254, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    marginBottom: '6px'
                                }}>
                                    Room {activePatient.roomNumber}
                                </span>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                                    {activePatient.name} (Age: {activePatient.age})
                                </h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                                    Diagnosis: <strong style={{ color: '#fff' }}>{activePatient.diagnosis}</strong>
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Risk Index</span>
                                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: getStatusColor(activePatient.status) }}>
                                        {activePatient.riskScore}/100
                                    </span>
                                </div>
                                <div style={{
                                    height: '36px',
                                    width: '1px',
                                    backgroundColor: 'rgba(255,255,255,0.08)'
                                }} />
                                <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Bed presence</span>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: activePatient.bedOccupancy ? '#10b981' : '#ef4444'
                                    }}>
                                        {activePatient.bedOccupancy ? '🟢 IN BED' : '🔴 LEFT BED'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Telemetry Core Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '320px 1fr 280px',
                            gap: '16px',
                            overflow: 'hidden'
                        }}>
                            {/* Sub-column 1: Live Streaming Feed */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                overflowY: 'auto',
                                minHeight: 0
                            }}>
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.45)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#05070d',
                                    minHeight: '200px'
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        left: '12px',
                                        zIndex: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(7, 10, 19, 0.75)',
                                        padding: '4px 10px',
                                        borderRadius: '6px'
                                    }}>
                                        <div style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: activePatient.videoFrame ? '#10b981' : '#ef4444',
                                            animation: 'pulse 1s infinite'
                                        }} />
                                        <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#cbd5e1' }}>
                                            {activePatient.videoFrame ? 'Live CCTV Link' : 'Feed Disconnected'}
                                        </span>
                                    </div>

                                    {activePatient.videoFrame ? (
                                        <video
                                            ref={remoteVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                transform: 'scaleX(-1)' // Mirror back
                                            }}
                                        />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎥</div>
                                            <p style={{ margin: 0, fontSize: '13px' }}>Patient camera offline</p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>
                                                Check bedside system link
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Component Score breakups */}
                                <div style={{
                                    background: 'rgba(30, 41, 59, 0.35)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        Risk Breakdown components
                                    </h4>
                                    <ScoreBar label="Vital Anomalies (SpO2, HR, Temp)" value={activePatient.riskScore > 30 ? Math.min(35, activePatient.riskScore - 10) : 10} max={35} color="#ef4444" />
                                    <ScoreBar label="Postural Displacement (Collapse / Out of Bed)" value={!activePatient.bedOccupancy || activePatient.headPosition === 'Collapsed' ? 30 : 0} max={30} color="#7c3aed" />
                                    <ScoreBar label="Mechanical Restlessness / Inactivity" value={activePatient.movementState === 'High Restlessness' ? 25 : activePatient.movementState === 'Unusual Inactivity' ? 20 : 5} max={25} color="#00f2fe" />
                                    <ScoreBar label="Fatigue / Unresponsiveness (Eyes Closed)" value={activePatient.eyesClosedSec > 5 ? 20 : activePatient.eyesClosedSec > 3 ? 10 : 0} max={20} color="#f97316" />
                                    <ScoreBar label="Neurological (Stroke/Delirium)" value={Math.max(activePatient.asymmetryScore || 0, activePatient.deliriumScore || 0)} max={30} color="#eab308" />
                                    <ScoreBar label="Airway Distress (MAR)" value={activePatient.marScore > 0.4 ? 20 : 0} max={20} color="#3b82f6" />
                                    <ScoreBar label="Pain Assessment" value={activePatient.painScore || 0} max={20} color="#ec4899" />
                                </div>
                            </div>

                            {/* Sub-column 2: Live Charts & Running Waves */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                overflowY: 'auto'
                            }}>
                                {/* Heart rate chart */}
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.45)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px',
                                    padding: '16px',
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444' }}>❤️ ECG HEART RATE (BPM)</span>
                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
                                            {activePatient.heartRate || '--'} <span style={{ fontSize: '11px', color: '#64748b' }}>bpm</span>
                                        </span>
                                    </div>
                                    <div style={{ flex: 1, position: 'relative', minHeight: '100px' }}>
                                        <VitalsWaveform history={hrHistory} min={40} max={130} strokeColor="#ef4444" fillColor="rgba(239, 68, 68, 0.05)" />
                                    </div>
                                </div>

                                {/* SpO2 chart */}
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.45)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '20px',
                                    padding: '16px',
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>🫁 PLETHYSMOGRAM SpO2 (%)</span>
                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                                            {activePatient.spo2 || '--'} <span style={{ fontSize: '11px', color: '#64748b' }}>%</span>
                                        </span>
                                    </div>
                                    <div style={{ flex: 1, position: 'relative', minHeight: '100px' }}>
                                        <VitalsWaveform history={spo2History} min={80} max={102} strokeColor="#10b981" fillColor="rgba(16, 185, 129, 0.05)" />
                                    </div>
                                </div>

                                {/* Vitals Grid Info details */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '12px'
                                }}>
                                    <StaticVitalBox label="Temp" value={activePatient.temperature ? `${activePatient.temperature} °C` : '--'} color="#f97316" />
                                    <StaticVitalBox label="Resp Rate" value={activePatient.respiratoryRate ? `${activePatient.respiratoryRate} rpm` : '--'} color="#3b82f6" />
                                    <StaticVitalBox label="Blood Press" value={activePatient.bloodPressure || '--'} color="#a78bfa" />
                                </div>
                            </div>

                            {/* Sub-column 3: Timeline & Emergency log */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.35)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '20px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                overflow: 'hidden'
                            }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#cbd5e1', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    Clinical Timeline log
                                </h3>

                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    {!activePatient.timeline || activePatient.timeline.length === 0 ? (
                                        <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
                                            No clinical events recorded.
                                        </p>
                                    ) : (
                                        activePatient.timeline.map((log, index) => {
                                            const color = getStatusColor(log.severity);
                                            return (
                                                <div key={index} style={{
                                                    padding: '10px 12px',
                                                    background: 'rgba(7, 10, 19, 0.5)',
                                                    borderLeft: `3px solid ${color}`,
                                                    borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '10px', color: '#64748b' }}>
                                                        <span>{log.time}</span>
                                                        <span style={{ color, fontWeight: 'bold' }}>{log.severity}</span>
                                                    </div>
                                                    <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.4' }}>
                                                        {log.event}
                                                    </p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b'
                    }}>
                        <span style={{ fontSize: '64px', marginBottom: '16px' }}>🏨</span>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#94a3b8' }}>
                            Clinical Monitor Awaiting Signals
                        </h2>
                        <p style={{ margin: 0, fontSize: '13px' }}>
                            Select a patient room from the side panel to view running clinical wave streams.
                        </p>
                    </div>
                )}
            </div>

            {isSettingsOpen && riskSettings && (
                <RiskSettingsModal
                    settings={riskSettings}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={(newSettings) => {
                        socket.emit('update-risk-settings', newSettings);
                        setIsSettingsOpen(false);
                    }}
                />
            )}

            {/* Custom slide animations */}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes flashingRedBorder {
                    0% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 5px rgba(239, 68, 68, 0.1); }
                    50% { border-color: rgba(239, 68, 68, 1); box-shadow: 0 0 15px rgba(239, 68, 68, 0.35); }
                    100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 5px rgba(239, 68, 68, 0.1); }
                }
                @keyframes pulse {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

// SVG rolling waveform component (Highly performant, premium look)
const VitalsWaveform = ({ history, min, max, strokeColor, fillColor }) => {
    if (history.length < 2) {
        return (
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#475569',
                border: '1px dashed rgba(255,255,255,0.03)',
                borderRadius: '8px'
            }}>
                Awaiting wave signals...
            </div>
        );
    }

    const width = 500;
    const height = 150;

    // Map history points to coordinates
    const points = history.map((val, i) => {
        const x = (i / (history.length - 1)) * width;
        // Clamp and map vertical values
        const clampedVal = Math.max(min, Math.min(max, val));
        const y = height - ((clampedVal - min) / (max - min)) * (height - 20) - 10;
        return { x, y };
    });

    // Build SVG polyline path
    const pathString = points.map((p) => `${p.x},${p.y}`).join(' ');

    // Build shaded area path string (connecting to bottom corners)
    const areaPathString = `${points[0].x},${height} ${pathString} ${points[points.length - 1].x},${height}`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={`glowGrad_${strokeColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                </linearGradient>
            </defs>
            {/* Shaded Area */}
            <polygon points={areaPathString} fill={`url(#glowGrad_${strokeColor.replace('#', '')})`} />
            
            {/* Grid Reference Lines */}
            <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />

            {/* Line Path */}
            <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                points={pathString}
                style={{
                    filter: `drop-shadow(0px 0px 4px ${strokeColor}77)`,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round'
                }}
            />
            {/* Pulsating cursor on latest point */}
            <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="4"
                fill={strokeColor}
            />
        </svg>
    );
};

// Components helpers
const ScoreBar = ({ label, value, max, color }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#cbd5e1' }}>{label}</span>
                <span style={{ color, fontWeight: 'bold' }}>{value}/{max}</span>
            </div>
            <div style={{
                height: '6px',
                width: '100%',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '3px',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 6px ${color}88`,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                }} />
            </div>
        </div>
    );
};

const StaticVitalBox = ({ label, value, color }) => (
    <div style={{
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.45)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '12px',
        textAlign: 'center'
    }}>
        <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</span>
        <strong style={{ fontSize: '14px', color: color }}>{value}</strong>
    </div>
);

export default CaretakerDashboard;
