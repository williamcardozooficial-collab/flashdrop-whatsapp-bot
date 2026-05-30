require('dotenv').config();
const express = require('express');
const path = require('path');
const { getClient, getStatus, getQRCode, restartClient } = require('./whatsapp');
const logger = require('./logger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../admin')));

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'flashdrop@2026';
const BOT_SECRET = process.env.BOT_SECRET || 'flashdrop-bot-secret';

function basicAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Autenticação necessária');
  }
  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('Credenciais inválidas');
}

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/status', basicAuth, (req, res) => {
  res.json(getStatus());
});

app.get('/api/qrcode', basicAuth, (req, res) => {
  const qr = getQRCode();
  if (!qr) return res.json({ qr: null });
  res.json({ qr });
});

app.post('/api/restart', basicAuth, async (req, res) => {
  await restartClient();
  res.json({ ok: true, message: 'Reconectando...' });
});

app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

app.get('/api/logs', basicAuth, (req, res) => {
  res.json(logger.getLogs());
});

// Rota interna para envio de mensagem WhatsApp (chamada pelo backend)
app.post('/api/send-message', async (req, res) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message são obrigatórios' });
  }
  try {
    const client = getClient();
    const status = getStatus();
    if (!status.connected) {
      return res.status(503).json({ error: 'WhatsApp não conectado' });
    }
    // Formata o número: remove tudo que não é dígito
    let digits = phone.replace(/\D/g, '');
    // Remove 55 inicial se já tiver para não duplicar
    if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
    // Se tiver 10 dígitos (sem o 9), adiciona o 9 após o DDD
    if (digits.length === 10) digits = digits.slice(0, 2) + '9' + digits.slice(2);
    // Adiciona código do Brasil
    const withCountry = '55' + digits;
    // Usa getNumberId para obter o JID correto no protocolo multi-device
    const numberId = await client.getNumberId(withCountry);
    if (!numberId) {
      logger.log('error', 'Número não encontrado no WhatsApp: ' + withCountry);
      return res.status(404).json({ error: 'Numero nao encontrado no WhatsApp: ' + withCountry });
    }
    await client.sendMessage(numberId._serialized, message);
    logger.log('outgoing', 'Mensagem enviada para ' + numberId._serialized);
    res.json({ ok: true, to: numberId._serialized });
  } catch (e) {
    logger.log('error', 'Erro ao enviar mensagem: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// Link do grupo WhatsApp (armazenado em memória)
let _groupLink = process.env.GROUP_LINK || '';

app.get('/api/group-link', basicAuth, (req, res) => {
  res.json({ link: _groupLink });
});

app.post('/api/group-link', basicAuth, (req, res) => {
  const { link } = req.body;
  _groupLink = (link || '').trim();
  res.json({ ok: true, link: _groupLink });
});

app.delete('/api/group-link', basicAuth, (req, res) => {
  _groupLink = '';
  res.json({ ok: true });
});

// Expoe o link do grupo para uso interno (usa bot-secret)
app.get('/api/group-link/internal', (req, res) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== BOT_SECRET) return res.status(403).json({ error: 'Acesso negado' });
  res.json({ link: _groupLink });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('FlashDrop WhatsApp Bot rodando na porta ' + PORT);
  getClient();
});
