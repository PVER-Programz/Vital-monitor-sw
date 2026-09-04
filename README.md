# 🏥 Vigilance ICU: AI Caretaker Monitoring System

Vigilance ICU is a real-time, AI-powered Patient Telemetry and Caretaker Monitoring System designed for clinical intensive care units. By combining client-side computer vision (via Google MediaPipe) and real-time vital signs analysis, the system evaluates patient stability, computes a four-part **Patient Risk Score**, and instantly alerts clinical staff of medical emergencies such as patient collapse, hypoxia, bradycardia, or bed exits.

---

## 🚀 Key Features

*   **Real-Time Patient CV Monitoring (MediaPipe)**:
    *   **Eye Closure Tracking**: Measures average Eye Aspect Ratio (EAR) approximation to detect sleep or unconsciousness states.
    *   **Mechanical Restlessness**: Evaluates continuous pixel-level displacement of key facial anchors to identify patient struggles, discomfort, or seizure-like movements.
    *   **Postural Collapse**: Tracks sudden drop in vertical head anchors to alert on patient collapses or slumps.
    *   **Bed Occupancy presence**: Alerts caretakers immediately if the camera detects that the patient has left the bed.
*   **Real-time Vitals & Waveforms**:
    *   Provides placeholders and rolling telemetry for **Heart Rate (bpm)**, **SpO2 (%)**, **Body Temperature (°C)**, **Respiratory Rate (rpm)**, and **Blood Pressure (mmHg)**.
    *   Features a built-in **Clinical Simulation Console** on the patient portal to simulate standard telemetry profiles (Tachycardia, Hypoxia, Collapse, Restlessness, Sleep, and Bed Exit).
*   **High-Tech Caretaker Control Dashboard**:
    *   Synchronizes active patient rooms dynamically using Socket.IO.
    *   Displays live streamed webcam frames of the patient.
    *   Draws responsive **ECG-like Heart Rate** and **Plethysmogram SpO2** rolling waveforms using custom, performant SVG graphics.
    *   Displays full rolling clinical logs and timelines of patient anomalies.
*   **Emergency Detection Engine & Notifications**:
    *   Launches floating slide-in alert warnings with medical sirens when vital metrics cross critical survival boundaries.

---

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, React Router DOM (v7)
*   **AI/CV Core**: Google MediaPipe Face Mesh (`@mediapipe/face_mesh`, `@mediapipe/camera_utils`)
*   **Backend**: Node.js, Express.js (v5)
*   **Database**: MongoDB (Mongoose)
*   **Real-time Sync**: Socket.IO, Socket.IO-Client
*   **Authentication**: JWT (JSON Web Tokens), bcryptjs

---

## 🧠 Patient Risk Scoring & Emergency Thresholds

The system continuously assesses patient stability using a four-part weighted scoring engine:

$$\text{Patient Risk Score} = \text{Movement Score} + \text{Vital Anomaly Score} + \text{Posture Score} + \text{Fatigue Score}$$

### 1. Risk Components
*   **Movement Score (0–25)**:
    *   *High Restlessness (e.g. struggle)*: +25 pts
    *   *Unusual Inactivity (motionless > 10s)*: +20 pts
*   **Vital Anomaly Score (0–70)**:
    *   *Hypoxia Danger ($SpO_2 < 92\%$)*: +35 pts
    *   *Tachycardia / Bradycardia ($HR > 100 \text{ or } < 50 \text{ bpm}$)*: +20 pts
    *   *Fever ($Temp > 38.5^{\circ}\text{C}$)*: +15 pts
*   **Posture Score (0–30)**:
    *   *Left Bed (Sensor Empty)*: +30 pts
    *   *Sudden Head Collapse / Slump*: +30 pts
*   **Fatigue Score (0–20)**:
    *   *Prolonged Eye Closure (> 5s)*: +20 pts

### 2. Clinical Categories
*   **0–30**: 🟢 **Stable** (Continuous Observation)
*   **31–60**: 🟡 **Observation Needed** (Nurse review suggested)
*   **61–80**: 🟠 **Nurse Alert** (Immediate bedside check required)
*   **81–100**: 🔴 **Emergency** (High priority code red alert)

---

## 📁 Project Architecture

```text
vigilance-icu/
├── backend/               # Express API and Socket.IO server
│   ├── config/            # DB connect logic (db.js)
│   ├── middleware/        # JWT Authentication protectors
│   ├── models/            # Mongoose clinical schemas (User.js, Patient.js, Alert.js)
│   ├── routes/            # REST API (auth.js, patient.js, alerts.js, icuMonitor.js)
│   ├── sockets/           # Real-time Telemetry Handler & Emergency Engine
│   └── server.js          # Main entry point
└── frontend/              # React SPA
    ├── src/
    │   ├── pages/         # Login.jsx, PatientDashboard.jsx, CaretakerDashboard.jsx
    │   ├── socket.js      # Global Socket.IO client instance
    │   ├── App.jsx        # Routing system
    │   ├── index.css      # Core clinical typography and resets
    │   └── App.css        # Layout boundaries
    └── package.json
```

---

## ⚙️ Setup and Installation

### Prerequisites
*   Node.js (v18+ recommended)
*   MongoDB instance (local running on port `27017` or MongoDB Atlas link)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the clinical server:
   ```bash
   node server.js
   ```
   *(Server starts on port `5000`)*

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
4. Access the clinical portal in your browser at `http://localhost:5173`.
