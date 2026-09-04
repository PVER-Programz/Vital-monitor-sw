import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('patient');
    const [age, setAge] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isLogin) {
                const res = await axios.post(`/api/auth/login`, { email, password });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data));

                if (res.data.role === 'patient') {
                    navigate('/patient');
                } else {
                    navigate('/caretaker');
                }
            } else {
                const res = await axios.post(`/api/auth/register`, {
                    name,
                    email,
                    password,
                    role,
                    age: role === 'patient' ? parseInt(age) : undefined,
                    room_number: role === 'patient' ? roomNumber : undefined,
                    diagnosis: role === 'patient' ? diagnosis : undefined
                });
                alert('Account registered successfully! Please log in.');
                setIsLogin(true);
                setEmail(email);
                setPassword('');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0f1d',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            color: '#f8fafc',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '460px',
                background: 'rgba(30, 41, 59, 0.45)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative glow */}
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-60px',
                    width: '180px',
                    height: '180px',
                    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-60px',
                    left: '-60px',
                    width: '180px',
                    height: '180px',
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        fontSize: '28px',
                        fontWeight: 'bold',
                        marginBottom: '16px'
                    }}>
                        ✚
                    </div>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        margin: '0 0 8px 0',
                        letterSpacing: '-0.5px',
                        background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Vigilance ICU
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                        Clinical Telemetry & Patient Monitoring Portal
                    </p>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    background: '#0f172a',
                    padding: '4px',
                    borderRadius: '12px',
                    marginBottom: '28px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        style={{
                            flex: 1,
                            background: isLogin ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            border: 'none',
                            color: isLogin ? '#ffffff' : '#64748b',
                            padding: '10px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        style={{
                            flex: 1,
                            background: !isLogin ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            border: 'none',
                            color: !isLogin ? '#ffffff' : '#64748b',
                            padding: '10px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {!isLogin && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Full Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Account Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="patient">Patient (Monitored Room Feed)</option>
                                    <option value="caretaker">ICU Caretaker (Monitoring Dashboard)</option>
                                </select>
                            </div>

                            {role === 'patient' && (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Age</label>
                                        <input
                                            type="number"
                                            placeholder="65"
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                            required
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Room #</label>
                                        <input
                                            type="text"
                                            placeholder="ICU-104"
                                            value={roomNumber}
                                            onChange={(e) => setRoomNumber(e.target.value)}
                                            required
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            )}

                            {role === 'patient' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Primary Diagnosis</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Cardiorespiratory Monitoring"
                                        value={diagnosis}
                                        onChange={(e) => setDiagnosis(e.target.value)}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Email Address</label>
                        <input
                            type="email"
                            placeholder="name@clinical.net"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Secure Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '15px',
                            cursor: 'pointer',
                            marginTop: '10px',
                            boxShadow: '0 8px 16px rgba(239, 68, 68, 0.25)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        {loading ? 'Processing clinical request...' : isLogin ? 'Access ICU Portal' : 'Register Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const inputStyle = {
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    transition: 'border-color 0.2s ease',
    ':focus': {
        borderColor: '#ef4444'
    }
};

export default Login;
