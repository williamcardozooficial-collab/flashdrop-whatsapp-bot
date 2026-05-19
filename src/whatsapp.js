
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { getAutoReply } = require('./ai');
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

  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    if (msg.isGroupMsg) return;

    const from = msg.from;
    const body = msg.body;
    logger.log('incoming', `De ${from}: ${body}`);

    try {
      const reply = await getAutoReply(from, body);
      if (reply) {
        await msg.reply(reply);
        logger.log('outgoing', `Para ${from}: ${reply}`);
      }
    } catch (err) {
      console.error('Erro ao responder:', err);
    }
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

async function restartClient() {
  status = { connected: false, phone: null, state: 'REINICIANDO' };
  currentQR = null;
  if (client) {
    try { await client.destroy(); } catch (e) {}
    client = null;
  }
  setTimeout(() => createClient(), 2000);
}

module.exports = { getClient, getStatus, getQRCode, restartClient };
