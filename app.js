const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'asdf',
    database: 'iot_monitor',
    port: 3306
});

// --- 🔥 ส่วนที่เพิ่ม: ตัวแปรจำค่าล่าสุดใน RAM (เพื่อให้ตรวจสอบได้เร็ว ไม่ต้องดึง DB) ---
let lastDeviceData = {
    temperature: 0,
    humidity: 0,
    timestamp: 0 // เก็บเวลาล่าสุดที่เป็น Milliseconds
};

// Helper: เช็คว่าออนไลน์หรือไม่ (ถ้าเวลาต่างกันไม่เกิน 10 วินาที = True)
const checkOnline = (ts) => (Date.now() - ts) < 10000;

app.post('/api/data', (req, res) => {
    const { temperature, humidity } = req.body;
    // อัปเดต RAM
    lastDeviceData = { temperature, humidity, timestamp: Date.now() }; 
    console.log(`Received: ${temperature}°C / ${humidity}% (Heartbeat Update)`);

    db.query('INSERT INTO sensor_logs (temperature, humidity, created_at) VALUES (?, ?, NOW())', [temperature, humidity], (err) => {
        if (err) return res.status(500).send('Database Error');
        
        // Emit ทันที (ใช้ spread operator ... ย่อการเขียน object)
        io.emit('sensor_update', { status: 'ONLINE', ...lastDeviceData, timestamp: new Date() });
        res.status(201).send('Data Saved');
    });
});

app.get('/api/status', (req, res) => {
    // ฟังก์ชันช่วยจัด Format ข้อมูลส่งกลับ
    const reply = (data, ts) => res.json({ ...data, created_at: new Date(ts), status: checkOnline(ts) ? 'ONLINE' : 'OFFLINE' });

    // 1. เช็ค RAM ก่อน
    if (lastDeviceData.timestamp !== 0) return reply(lastDeviceData, lastDeviceData.timestamp);

    // 2. ถ้า RAM ว่าง ให้เช็ค DB
    db.query('SELECT * FROM sensor_logs ORDER BY created_at DESC LIMIT 1', (err, results) => {
        if (err) return res.status(500).send(err);
        if (!results.length) return res.json({ status: 'NO_DATA' });
        
        reply(results[0], new Date(results[0].created_at).getTime());
    });
});

// Ping Monitor: เช็คทุก 5 วินาที
setInterval(() => {
    // ถ้ามีข้อมูลใน RAM และเวลาเกิน 10 วิ -> แจ้ง OFFLINE
    if (lastDeviceData.timestamp !== 0 && !checkOnline(lastDeviceData.timestamp)) {
        console.log("⚠️ Device Offline detected!");
        io.emit('sensor_update', { status: 'OFFLINE', ...lastDeviceData, timestamp: new Date(lastDeviceData.timestamp) });
    }
}, 5000);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Waiting for Arduino Heartbeat...`);
});
