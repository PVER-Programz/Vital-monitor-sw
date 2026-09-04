import React, { useState } from 'react';

const ToggleSwitch = ({ label, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e2e8f0' }}>{label}</span>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ srOnly: true, opacity: 0, width: 0, height: 0 }} />
                <div style={{ width: '40px', height: '20px', backgroundColor: checked ? '#10b981' : '#475569', borderRadius: '20px', transition: 'all 0.3s' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: checked ? '22px' : '2px', transition: 'all 0.3s' }} />
                </div>
            </div>
        </label>
    </div>
);

const NumberInput = ({ label, value, onChange, min = 0, max = 100 }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{label}</span>
        <input 
            type="number" 
            value={value} 
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            style={{ width: '60px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
        />
    </div>
);

export default function RiskSettingsModal({ settings, onClose, onSave }) {
    const [localSettings, setLocalSettings] = useState(JSON.parse(JSON.stringify(settings))); // deep copy

    const handleSave = () => {
        onSave(localSettings);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
        }}>
            <div style={{
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                fontFamily: "'Outfit', 'Inter', sans-serif"
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: 'white', fontSize: '20px' }}>⚙️ Risk Score Customization</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>
                
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    {/* Movement Score */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                        <ToggleSwitch 
                            label="Movement & Posture Score" 
                            checked={localSettings.movement.enabled} 
                            onChange={(val) => setLocalSettings(s => ({...s, movement: {...s.movement, enabled: val}}))}
                        />
                        {localSettings.movement.enabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <NumberInput label="Rested" value={localSettings.movement.rested} onChange={val => setLocalSettings(s => ({...s, movement: {...s.movement, rested: val}}))} />
                                <NumberInput label="Active" value={localSettings.movement.active} onChange={val => setLocalSettings(s => ({...s, movement: {...s.movement, active: val}}))} />
                                <NumberInput label="Restless" value={localSettings.movement.restless} onChange={val => setLocalSettings(s => ({...s, movement: {...s.movement, restless: val}}))} />
                                <NumberInput label="Unusual Inactivity" value={localSettings.movement.unusualInactivity} onChange={val => setLocalSettings(s => ({...s, movement: {...s.movement, unusualInactivity: val}}))} />
                                <NumberInput label="Bed Unoccupied" value={localSettings.movement.bedUnoccupied} onChange={val => setLocalSettings(s => ({...s, movement: {...s.movement, bedUnoccupied: val}}))} />
                            </div>
                        )}
                    </div>

                    {/* Vitals Score */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                        <ToggleSwitch 
                            label="Vital Anomaly Score" 
                            checked={localSettings.vitals.enabled} 
                            onChange={(val) => setLocalSettings(s => ({...s, vitals: {...s.vitals, enabled: val}}))}
                        />
                        {localSettings.vitals.enabled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* SpO2 */}
                                <div style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#00f2fe' }}>SpO₂ (%)</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                        <input type="range" min="0" max="100" value={localSettings.vitals.spo2.threshold} onChange={(e) => setLocalSettings(s => ({...s, vitals: {...s.vitals, spo2: {...s.vitals.spo2, threshold: Number(e.target.value)}}}))} style={{ flex: 1 }} />
                                        <span style={{ color: 'white' }}>{localSettings.vitals.spo2.threshold}%</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <NumberInput label={`Pts at < ${localSettings.vitals.spo2.threshold}% (min)`} value={localSettings.vitals.spo2.belowThresholdMin} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, spo2: {...s.vitals.spo2, belowThresholdMin: val}}}))} />
                                        <NumberInput label={`Pts at > ${localSettings.vitals.spo2.threshold}% (max)`} value={localSettings.vitals.spo2.aboveThresholdMax} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, spo2: {...s.vitals.spo2, aboveThresholdMax: val}}}))} />
                                    </div>
                                </div>
                                {/* HR */}
                                <div style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Heart Rate (bpm)</h4>
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                                        <NumberInput label="Lower Threshold" value={localSettings.vitals.heartRate.lowerThreshold} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, heartRate: {...s.vitals.heartRate, lowerThreshold: val}}}))} max={220} />
                                        <NumberInput label="Upper Threshold" value={localSettings.vitals.heartRate.upperThreshold} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, heartRate: {...s.vitals.heartRate, upperThreshold: val}}}))} max={220} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <NumberInput label={`Pts at < ${localSettings.vitals.heartRate.lowerThreshold} (min)`} value={localSettings.vitals.heartRate.belowLowerMin} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, heartRate: {...s.vitals.heartRate, belowLowerMin: val}}}))} />
                                        <NumberInput label={`Pts at > ${localSettings.vitals.heartRate.upperThreshold} (min)`} value={localSettings.vitals.heartRate.aboveUpperMin} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, heartRate: {...s.vitals.heartRate, aboveUpperMin: val}}}))} />
                                    </div>
                                </div>
                                {/* Temp */}
                                <div style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#f97316' }}>Temperature (°C)</h4>
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                                        <NumberInput label="Lower Threshold" value={localSettings.vitals.temperature.lowerThreshold} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, temperature: {...s.vitals.temperature, lowerThreshold: val}}}))} min={30} max={45} />
                                        <NumberInput label="Upper Threshold" value={localSettings.vitals.temperature.upperThreshold} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, temperature: {...s.vitals.temperature, upperThreshold: val}}}))} min={30} max={45} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <NumberInput label={`Pts at < ${localSettings.vitals.temperature.lowerThreshold} (min)`} value={localSettings.vitals.temperature.belowLowerMin} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, temperature: {...s.vitals.temperature, belowLowerMin: val}}}))} />
                                        <NumberInput label={`Pts at > ${localSettings.vitals.temperature.upperThreshold} (min)`} value={localSettings.vitals.temperature.aboveUpperMin} onChange={val => setLocalSettings(s => ({...s, vitals: {...s.vitals, temperature: {...s.vitals.temperature, aboveUpperMin: val}}}))} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fatigue Score */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                        <ToggleSwitch 
                            label="Fatigue Score" 
                            checked={localSettings.fatigue.enabled} 
                            onChange={(val) => setLocalSettings(s => ({...s, fatigue: {...s.fatigue, enabled: val}}))}
                        />
                        {localSettings.fatigue.enabled && (
                            <div>
                                {localSettings.fatigue.rules.map((rule, idx) => (
                                    <div key={rule.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                                        <select value={rule.type} onChange={e => {
                                            const newRules = [...localSettings.fatigue.rules];
                                            newRules[idx].type = e.target.value;
                                            setLocalSettings(s => ({...s, fatigue: {...s.fatigue, rules: newRules}}));
                                        }} style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px' }}>
                                            <option value="eyes_open">Eyes Open</option>
                                            <option value="eyes_closed">Eyes Closed</option>
                                        </select>
                                        <span style={{ color: '#cbd5e1' }}>&gt;</span>
                                        <input type="number" value={rule.seconds} onChange={e => {
                                            const newRules = [...localSettings.fatigue.rules];
                                            newRules[idx].seconds = Number(e.target.value);
                                            setLocalSettings(s => ({...s, fatigue: {...s.fatigue, rules: newRules}}));
                                        }} style={{ width: '60px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px' }} />
                                        <span style={{ color: '#cbd5e1' }}>sec :</span>
                                        <input type="number" value={rule.points} onChange={e => {
                                            const newRules = [...localSettings.fatigue.rules];
                                            newRules[idx].points = Number(e.target.value);
                                            setLocalSettings(s => ({...s, fatigue: {...s.fatigue, rules: newRules}}));
                                        }} style={{ width: '50px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px' }} />
                                        <span style={{ color: '#cbd5e1' }}>pts</span>
                                        <button onClick={() => {
                                            const newRules = localSettings.fatigue.rules.filter(r => r.id !== rule.id);
                                            setLocalSettings(s => ({...s, fatigue: {...s.fatigue, rules: newRules}}));
                                        }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑</button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const newRules = [...localSettings.fatigue.rules, { id: Date.now(), type: 'eyes_open', condition: '>', seconds: 0, points: 0 }];
                                    setLocalSettings(s => ({...s, fatigue: {...s.fatigue, rules: newRules}}));
                                }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginTop: '10px' }}>
                                    + Add Custom Rule
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Alerts */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#e2e8f0' }}>Alert Notification Levels</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <ToggleSwitch label="Level-1 (Observation)" checked={localSettings.alerts.level1.enabled} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level1: {...s.alerts.level1, enabled: val}}}))} />
                                {localSettings.alerts.level1.enabled && <NumberInput label="> Points" value={localSettings.alerts.level1.threshold} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level1: {...s.alerts.level1, threshold: val}}}))} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <ToggleSwitch label="Level-2 (Nurse Notify)" checked={localSettings.alerts.level2.enabled} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level2: {...s.alerts.level2, enabled: val}}}))} />
                                {localSettings.alerts.level2.enabled && <NumberInput label="> Points" value={localSettings.alerts.level2.threshold} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level2: {...s.alerts.level2, threshold: val}}}))} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <ToggleSwitch label="Level-3 (Emergency)" checked={localSettings.alerts.level3.enabled} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level3: {...s.alerts.level3, enabled: val}}}))} />
                                {localSettings.alerts.level3.enabled && <NumberInput label="> Points" value={localSettings.alerts.level3.threshold} onChange={val => setLocalSettings(s => ({...s, alerts: {...s.alerts, level3: {...s.alerts.level3, threshold: val}}}))} />}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ padding: '8px 16px', background: '#10b981', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                </div>
            </div>
        </div>
    );
}
