require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const webhookRouter = require('./webhook');
const sessionRouter = require('./session');
const { getLogs } = require('./logger');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60000, max: 100 }));
function basicAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) { res.setHeader('WWW-Authenticate','Basic realm="FlashDrop Admin"'); return res.status(401).send('Acesso negado.'); }
  const [user,pass] = Buffer.from(auth.split(' ')[1],'base64').toString().split(':');
  if (user===process.env.ADMIN_USER && pass===process.env.ADMIN_PASS) return next();
  res.setHeader('WWW-Authenticate','Basic realm="FlashDrop Admin"'); return res.status(401).send('Credenciais invalidas.');
}
app.get('/health',(req,res) => res.json({ok:true,uptime:process.uptime()}));
app.use('/webhook', webhookRouter);
app.use('/session', sessionRouter);
app.use('/admin', basicAuth);
app.get('/admin',(req,res) => res.sendFile(path.join(__dirname,'../admin/index.html')));
app.get('/admin/logs', basicAuth,(req,res) => res.json(getLogs()));
app.listen(PORT, () => {
  console.log('[SERVER] FlashDrop WhatsApp Bot porta '+PORT);
  const { registerWebhook } = require('./session');
  setTimeout(registerWebhook, 5000);
});
