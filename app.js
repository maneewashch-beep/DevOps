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

// 1. API รับข้อมูลจาก Arduino (POST)
app.post('/api/data', (req, res) => {
    const { temperature, humidity } = req.body;

    // อัปเดตเวลาล่าสุดทันทีที่มีข้อมูลเข้ามา
    lastDeviceData = {
        temperature: temperature,
        humidity: humidity,
        timestamp: Date.now() // บันทึกเวลาปัจจุบัน (Heartbeat)
    };

    console.log(`Received: ${temperature}°C / ${humidity}% (Heartbeat Update)`);

    const sql = 'INSERT INTO sensor_logs (temperature, humidity, created_at) VALUES (?, ?, NOW())';
    
    db.query(sql, [temperature, humidity], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        
        // ส่งสถานะ ONLINE ทันทีเมื่อข้อมูลเข้า
        io.emit('sensor_update', { 
            status: 'ONLINE', 
            temperature: temperature, 
            humidity: humidity,
            timestamp: new Date()
        });

        res.status(201).send('Data Saved');
    });
});

app.get('/api/status', (req, res) => {
    const now = Date.now();
    const diff = now - lastDeviceData.timestamp;
    const isOnline = diff < 10000; 

    if (lastDeviceData.timestamp !== 0) {
        res.json({
            temperature: lastDeviceData.temperature,
            humidity: lastDeviceData.humidity,
            created_at: new Date(lastDeviceData.timestamp),
            status: isOnline ? 'ONLINE' : 'OFFLINE'
        });
    } else {
        // ถ้า RAM ว่างเปล่า (เพิ่งเปิด Server) ให้ไปดูใน DB แทน
        const sql = 'SELECT * FROM sensor_logs ORDER BY created_at DESC LIMIT 1';
        db.query(sql, (err, results) => {
            if (err) return res.status(500).send(err);
            if (results.length > 0) {
                const latest = results[0];
                const dbTime = new Date(latest.created_at).getTime();
                const dbDiff = Date.now() - dbTime;
                
                res.json({
                    ...latest,
                    status: (dbDiff < 10000) ? 'ONLINE' : 'OFFLINE'
                });
            } else {
                res.json({ status: 'NO_DATA' });
            }
        });
    }
});

// --- 🔥 ส่วนที่เพิ่ม: ระบบ Ping Monitor (Server ทำงานเองทุก 5 วินาที) ---
setInterval(() => {
    const now = Date.now();
    const diff = now - lastDeviceData.timestamp;

    // ถ้าไม่มีข้อมูลมาเกิน 10 วินาที (เผื่อดีเลย์นิดหน่อย)
    if (diff > 10000 && lastDeviceData.timestamp !== 0) {
        // ประกาศให้หน้าเว็บรู้ว่า "OFFLINE แล้วนะ"
        console.log("⚠️ Device Offline detected!");
        io.emit('sensor_update', {
            status: 'OFFLINE',
            temperature: lastDeviceData.temperature,
            humidity: lastDeviceData.humidity,
            timestamp: new Date(lastDeviceData.timestamp)
        });
    } 
    // ถ้ายังปกติ ไม่ต้องส่งอะไร (ลดภาระ Network) หรือจะส่ง ONLINE ย้ำก็ได้
}, 5000); // ทำงานทุก 5 วินาที

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Waiting for Arduino Heartbeat...`);
});