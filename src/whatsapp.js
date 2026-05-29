const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const logger = require('./logger');

let client = null;
let currentQR = null;
let status = { connected: false, phone: null, state: 'DESCONECTADO' };

function getStatus() { return status; }
function getQRCode() { return currentQR; }

function createClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/tmp/wwebjs_auth' }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true
    }
  });

  client.on('qr', async (qr) => {
    console.log('QR Code gerado, escaneie no painel admin');
    status = { connected: false, phone: null, state: 'AGUARDANDO_QR' };
    try {
      currentQR = await qrcode.toDataURL(qr);
    } catch (e) {
      console.error('Erro ao gerar QR:', e);
    }
  });

  client.on('ready', () => {
    console.log('WhatsApp conectado!');
    currentQR = null;
    const info = client.info;
    status = {
      connected: true,
      phone: info ? info.wid.user : 'Desconhecido',
      state: 'CONECTADO'
    };
    logger.log('system', 'WhatsApp conectado: ' + status.phone);
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp desconectado:', reason);
    status = { connected: false, phone: null, state: 'DESCONECTADO' };
    currentQR = null;
    logger.log('system', 'WhatsApp desconectado: ' + reason);
    setTimeout(() => createClient(), 5000);
  });

  // Ignora todas as mensagens recebidas - sem resposta automatica
  client.on('message', (msg) => {
    logger.log('incoming', 'Mensagem recebida de ' + msg.from + ' (ignorada)');
  });

  client.initialize().catch(err => {
    console.error('Erro ao inicializar WhatsApp:', err);
    setTimeout(() => createClient(), 10000);
  });

  return client;
}

function getClient() {
  if (!client) createClient();
  return client;
}

async function sendMessage(phone, text) {
  const c = getClient();
  if (!status.connected) throw new Error('WhatsApp nao conectado');
  // Limpa o numero: remove tudo que nao e digito
  let clean = phone.replace(/\D/g, '');
  // Adiciona codigo do Brasil se nao tiver (55)
  if (!clean.startsWith('55')) clean = '55' + clean;
  // Resolve o JID correto via getNumberId (evita erro "No LID for user")
  const numberId = await c.getNumberId(clean);
  if (!numberId) throw new Error('Numero nao encontrado no WhatsApp: ' + clean);
  await c.sendMessage(numberId._serialized, text);
  logger.log('outgoing', 'Mensagem enviada para ' + clean);
}

async function restartClient() {
  status = { connected: false, phone: null, state: 'REINICIANDO' };
  currentQR = null;
  if (client) {
    try { await client.destroy(); } catch (e) {}
    client = null;
  }
  setTimeout(() => createClient(), 2000);
}

module.exports = { getClient, getStatus, getQRCode, sendMessage, restartClient };
