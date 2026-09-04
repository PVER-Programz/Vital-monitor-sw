const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const caretakerRoutes = require('./routes/caretaker');
const alertsRoutes = require('./routes/alerts');
const icuMonitorRoutes = require('./routes/icuMonitor');
const socketHandler = require('./sockets/socketHandler');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/caretaker', caretakerRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/icu-monitor', icuMonitorRoutes);

// Socket.IO Logic
socketHandler(io);

// Simulate route
app.post('/simulate', (req, res) => {
    const { room, mode } = req.body;
    if (!room || !mode) {
        return res.status(400).json({ error: 'Room and mode are required' });
    }
    io.emit('set-simulation-mode', { room, mode });
    res.json({ message: `Simulation mode ${mode} sent to room ${room}` });
});

// Sensor data from external hardware
app.post('/sensor', (req, res) => {
    const room = req.query.room;
    const { heart_rate, spO2, temp, resp_rate, ABP } = req.body;
    
    if (!room) {
        return res.status(400).json({ error: 'Room is required' });
    }
    
    io.emit('sensor-data', { room, heart_rate, spO2, temp, resp_rate, ABP });
    res.json({ room: room, sys_time: Math.floor(Date.now() / 1000) });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
