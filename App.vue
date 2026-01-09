<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const sensorData = ref({
  temperature: 0,
  humidity: 0,
  status: 'LOADING',
  created_at: ''
});

const fetchData = async () => {
  try {
    const res = await axios.get('http://192.168.32.47:3000/api/status');
    sensorData.value = res.data;
  } catch (error) {
    console.error("Connection Error", error);
    sensorData.value.status = 'ERROR';
  }
};

onMounted(() => {
  fetchData();
  // ดึงข้อมูลใหม่ทุกๆ 5 วินาที (Polling)
  setInterval(fetchData, 5000);
});
</script>

<template>
  <div class="dashboard">
    <h1>🌡️ Arduino Monitor</h1>
    
    <div class="card" :class="sensorData.status">
      <h2>Status: {{ sensorData.status }}</h2>
      <p v-if="sensorData.created_at">Last update: {{ new Date(sensorData.created_at).toLocaleTimeString() }}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <h3>Temperature</h3>
        <p class="value">{{ Number(sensorData.temperature).toFixed(1) }} °C</p>
      </div>
      <div class="stat-box">
        <h3>Humidity</h3>
        <p class="value">{{ Number(sensorData.humidity).toFixed(1) }} %</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { font-family: Arial, sans-serif; text-align: center; max-width: 600px; margin: 0 auto; }
.card { padding: 20px; border-radius: 10px; margin-bottom: 20px; color: white; }
.card.ONLINE { background-color: #4caf50; }
.card.OFFLINE { background-color: #f44336; }
.card.LOADING { background-color: #9e9e9e; }
.stats-grid { display: flex; gap: 20px; justify-content: center; }
.stat-box { border: 1px solid #ddd; padding: 20px; border-radius: 10px; width: 150px; }
.value { font-size: 2em; font-weight: bold; }
</style>