require('dotenv').config();
const express = require('express');
const path = require('path');
const { getClient, getStatus, getQRCode, restartClient } = require('./whatsapp');
const logger = require('./logger'); function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); } function withTimeout(promise, ms, label) { return new Promise(function (resolve, reject) { var timer = setTimeout(function () { reject(new Error('TIMEOUT: ' + label + ' demorou mais de ' + ms + 'ms')); }, ms); Promise.resolve(promise).then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); }); }); }
// sendWithRetry agora tambem coloca o timeout (nao so os erros classicos do
// Puppeteer) como motivo para reiniciar o WhatsApp e tentar de novo. Antes,
// um travamento tipo "TIMEOUT: getNumberId demorou..." nao disparava o
// reinicio automatico - so falhava e ficava travado ate alguem clicar em
// "Reconectar" manualmente no painel.
async function sendWithRetry(sendFn, timeoutMs, label) {
  timeoutMs = timeoutMs || 25000;
  label = label || 'operacao';
  try {
    await withTimeout(sendFn(), timeoutMs, label);
  } catch (e) {
    if (/Runtime\.callFunctionOn timed out|Protocol error|Target closed|^TIMEOUT:/i.test(e.message)) {
      logger.log('error', 'Falha transitoria (' + label + '), reiniciando WhatsApp e tentando novamente: ' + e.message);
      await restartClient();
      await sleep(10000);
      await withTimeout(sendFn(), timeoutMs, label);
      return;
    }
    throw e;
  }
}

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
})
app.post('/api/logout', basicAuth, async (req, res) => {
  try {
    const c = getClient();
    if (c) await c.logout();
    logger.log('WhatsApp desconectado via painel admin');
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});
;

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
    const withCountry = '55' + digits;
    // Usa getNumberId para obter o JID correto no protocolo multi-device.
    // Envolvido em sendWithRetry: se essa chamada travar (era o que estava
    // acontecendo - Chrome travado sem dar erro nenhum, so nao respondia),
    // reinicia o WhatsApp sozinho e tenta de novo em vez de so falhar.
    let numberId;
    await sendWithRetry(async function () { numberId = await (getClient()).getNumberId(withCountry); }, 20000, 'getNumberId');
    if (!numberId) {
      logger.log('error', 'Número não encontrado no WhatsApp: ' + withCountry);
      return res.status(404).json({ error: 'Numero nao encontrado no WhatsApp: ' + withCountry });
    }
    await sendWithRetry(async function () { await (getClient()).sendMessage(numberId._serialized, message); }, 20000, 'sendMessage');
    logger.log('outgoing', 'Mensagem enviada para ' + numberId._serialized);
    res.json({ ok: true, to: numberId._serialized });
  } catch (e) {
    logger.log('error', 'Erro ao enviar mensagem: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// Link(s) do(s) grupo(s) WhatsApp (persistido em arquivo /tmp). Suporta mais de
// um grupo simultaneo - "principal" (grupo 1, comportamento original/padrao) e
// "secundario" (grupo 2, novo) - cada um com seu proprio link salvo e suas
// proprias mensagens, decididas por quem chama /api/send-group-message atraves
// do campo "grupo" no corpo da requisicao ('principal' por padrao, para nao
// quebrar quem ja chama esse endpoint sem informar o campo).
const fs = require('fs');
const GROUPS = {
  principal: { file: '/tmp/group_link.txt', envVar: 'GROUP_LINK' },
  secundario: { file: '/tmp/group_link_2.txt', envVar: 'GROUP_LINK_2' },
};
function _loadGroupLink(file) { try { return fs.readFileSync(file,'utf8').trim(); } catch(e) { return ''; } }
function _saveGroupLink(file, v) { try { fs.writeFileSync(file, v||'', 'utf8'); } catch(e) {} }
const _groupLinks = {
  principal: process.env.GROUP_LINK || _loadGroupLink(GROUPS.principal.file),
  secundario: process.env.GROUP_LINK_2 || _loadGroupLink(GROUPS.secundario.file),
};
function _grupoKey(v) { return (v === 'secundario' || v === 2 || v === '2') ? 'secundario' : 'principal'; }

app.get('/api/group-link', basicAuth, (req, res) => {
  const key = _grupoKey(req.query.grupo);
  res.json({ link: _groupLinks[key] });
});
app.post('/api/group-link', basicAuth, (req, res) => {
  const { link, grupo } = req.body;
  const key = _grupoKey(grupo);
  _groupLinks[key] = (link || '').trim();
  _saveGroupLink(GROUPS[key].file, _groupLinks[key]);
  res.json({ ok: true, link: _groupLinks[key] });
});
app.delete('/api/group-link', basicAuth, (req, res) => {
  const key = _grupoKey(req.query.grupo || (req.body && req.body.grupo));
  _groupLinks[key] = '';
  _saveGroupLink(GROUPS[key].file, '');
  res.json({ ok: true });
});
app.get('/api/group-link/internal', (req, res) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== BOT_SECRET) return res.status(403).json({ error: 'Acesso negado' });
  const key = _grupoKey(req.query.grupo);
  res.json({ link: _groupLinks[key] });
});

// Envia mensagem para o grupo WhatsApp pelo ID salvo. O campo opcional "grupo"
// no corpo ('principal' ou 'secundario', ou 1/2) escolhe qual grupo recebe -
// se omitido, usa o grupo principal (mesmo comportamento de sempre).
app.post('/api/send-group-message', async (req, res) => {
  const secret = req.headers['x-bot-secret'];
  if (secret !== BOT_SECRET) return res.status(403).json({ error: 'Acesso negado' });
  const { message, mentionAll, grupo } = req.body;
  const key = _grupoKey(grupo);
  const groupLink = _groupLinks[key];
  if (!message) return res.status(400).json({ error: 'message obrigatorio' });
  if (!groupLink) return res.status(404).json({ error: 'Grupo (' + key + ') nao configurado' });
  if (!groupLink.includes('@g.us')) return res.status(400).json({ error: 'Use Ver Grupos para selecionar o grupo (' + key + ') pelo ID direto' });
  try {
    const client = getClient();
    const status = getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp nao conectado' });
    let finalMessage = message; let mentionIds = []; if (mentionAll) { try { const chat = await client.getChatById(groupLink.trim()); if (chat && chat.participants) { mentionIds = chat.participants.map(p => p.id._serialized); if (mentionIds.length) { finalMessage = finalMessage + ' ' + mentionIds.map(id => '@' + id.split('@')[0]).join(' '); } } } catch (eMention) { logger.log('error', 'Erro ao buscar participantes: ' + eMention.message); } } await sendWithRetry(async function () { await (getClient()).sendMessage(groupLink.trim(), finalMessage, mentionIds.length ? { mentions: mentionIds } : undefined); }, 20000, 'sendGroupMessage');
    logger.log('outgoing', 'Mensagem enviada para o grupo (' + key + '): ' + groupLink);
    res.json({ ok: true, groupId: groupLink, grupo: key });
  } catch (e) {
    logger.log('error', 'Erro grupo: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// Lista os grupos que o bot participa (para obter o ID direto)
app.get('/api/groups', basicAuth, async (req, res) => {
  try {
    const client = getClient();
    const status = getStatus();
    if (!status.connected) return res.status(503).json({ error: 'WhatsApp nao conectado' });
    const chats = await client.getChats();
    const groups = chats
      .filter(c => c.isGroup)
      .map(c => ({ id: c.id._serialized, name: c.name }));
    res.json(groups);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('FlashDrop WhatsApp Bot rodando na porta ' + PORT);
  getClient();
});
