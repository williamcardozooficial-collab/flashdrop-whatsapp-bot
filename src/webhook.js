const express = require('express');
const router = express.Router();
const { processMessage } = require('./ai');
const { sendMessage } = require('./whatsapp');
const { addLog } = require('./logger');
const processing = new Set();

router.post('/', async (req, res) => {
    return res.status(200).json({ ok: true });
  try {
    const body = req.body;
    const event = body.event || body.type;
    if (!event || !['messages.upsert','MESSAGES_UPSERT'].includes(event)) return;
    const data = body.data || body;
    const message = data.messages?.[0] || data.message;
    if (!message) return;
    if (message.key?.fromMe) return;
    const remoteJid = message.key?.remoteJid || '';
    if (remoteJid.includes('@g.us')) return;
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || null;
    if (!text || !text.trim()) return;
    const phone = remoteJid.split('@')[0];
    const pushName = message.pushName || 'Cliente';
    const msgId = message.key?.id;
    if (msgId && processing.has(msgId)) return;
    if (msgId) processing.add(msgId);
    console.log(`[WEBHOOK] ${pushName} (${phone}): ${text}`);
    addLog({ type: 'received', phone, name: pushName, text, timestamp: new Date().toISOString() });
    const response = await processMessage(phone, pushName, text);
    if (response) {
      await sendMessage(remoteJid, response);
      addLog({ type: 'sent', phone, text: response, timestamp: new Date().toISOString() });
    }
    setTimeout(() => processing.delete(msgId), 10000);
  } catch(e) { console.error('[WEBHOOK] Erro:', e.message); }
});

module.exports = router;
