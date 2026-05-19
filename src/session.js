const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getInstanceStatus, getQRCode, reconnectInstance } = require('./whatsapp');
const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'flashdrop';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const hdrs = () => ({ 'apikey': API_KEY, 'Content-Type': 'application/json' });

async function ensureInstanceExists() {
  try {
    const res = await axios.get(`${BASE_URL}/instance/fetchInstances`, { headers: hdrs(), timeout: 10000 });
    const instances = res.data || [];
    const exists = instances.some(i => (i.instance?.instanceName || i.instanceName) === INSTANCE);
    if (!exists) {
      await axios.post(`${BASE_URL}/instance/create`, { instanceName: INSTANCE, qrcode: true, integration: 'WHATSAPP-BAILEYS' }, { headers: hdrs(), timeout: 15000 });
      console.log(`[SESSION] Instancia "${INSTANCE}" criada!`);
    }
  } catch(e) { console.error('[SESSION] Erro instancia:', e.message); }
}

async function registerWebhook() {
  if (!WEBHOOK_URL || !BASE_URL || !API_KEY) { console.warn('[SESSION] Variaveis nao definidas.'); return; }
  try {
    await ensureInstanceExists();
    await axios.post(`${BASE_URL}/webhook/set/${INSTANCE}`, { url: `${WEBHOOK_URL}/webhook`, webhook_by_events: false, webhook_base64: false, events: ['MESSAGES_UPSERT'] }, { headers: hdrs(), timeout: 10000 });
    console.log(`[SESSION] Webhook registrado: ${WEBHOOK_URL}/webhook`);
  } catch(e) { console.error('[SESSION] Erro webhook:', e.response?.data || e.message); }
}

router.get('/status', async (req, res) => res.json(await getInstanceStatus()));
router.get('/qrcode', async (req, res) => res.json(await getQRCode()));
router.post('/reconnect', async (req, res) => res.json(await reconnectInstance()));

module.exports = router;
module.exports.registerWebhook = registerWebhook;
