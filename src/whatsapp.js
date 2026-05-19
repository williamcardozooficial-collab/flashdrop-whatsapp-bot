const axios = require('axios');
const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'flashdrop';
const hdrs = () => ({ 'apikey': API_KEY, 'Content-Type': 'application/json' });

async function sendMessage(to, text) {
  try {
    const r = await axios.post(`${BASE_URL}/message/sendText/${INSTANCE}`, { number: to, text }, { headers: hdrs(), timeout: 15000 });
    console.log(`[WA] Mensagem enviada para ${to}`);
    return r.data;
  } catch(e) { console.error('[WA] Erro enviar:', e.response?.data || e.message); throw e; }
}

async function getInstanceStatus() {
  try {
    const r = await axios.get(`${BASE_URL}/instance/connectionState/${INSTANCE}`, { headers: hdrs(), timeout: 10000 });
    return r.data;
  } catch(e) { return { state: 'error', error: e.message }; }
}

async function getQRCode() {
  try {
    const r = await axios.get(`${BASE_URL}/instance/connect/${INSTANCE}`, { headers: hdrs(), timeout: 10000 });
    return r.data;
  } catch(e) { return { error: e.message }; }
}

async function reconnectInstance() {
  try {
    const r = await axios.put(`${BASE_URL}/instance/restart/${INSTANCE}`, {}, { headers: hdrs(), timeout: 15000 });
    return r.data;
  } catch(e) { return { error: e.message }; }
}

module.exports = { sendMessage, getInstanceStatus, getQRCode, reconnectInstance };
