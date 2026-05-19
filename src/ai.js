const axios = require('axios');
const conversations = new Map();
const MAX_HISTORY = 10;
const SESSION_TTL = 30 * 60 * 1000;
const CADASTRO_LINK = process.env.CADASTRO_LINK || 'https://flashdrop-frontend-six.vercel.app/register.html';

const SYSTEM_PROMPT = `Voce e o assistente virtual da FlashDrop, plataforma de delivery em Caxias do Sul - RS.

SOBRE A FLASHDROP: Conecta lojas locais, motoboys autonomos e clientes. Sistema completo com painel web para loja, app para motoboys e vitrine para clientes.

COMO FUNCIONA: Loja se cadastra GRATIS, cadastra cardapio, recebe pedidos no painel, motoboys sao notificados automaticamente, fazem a coleta e entrega.

PAINEL DA LOJA: Pedidos em tempo real, gerencia status (novo->preparo->entrega->entregue), cardapio com fotos e precos, relatorios.

CARDAPIO VIRTUAL: Fotos, descricoes, variacoes (tamanhos/sabores), categorias personalizadas.

MOTOBOYS: Autonomos, notificacao em tempo real, app via navegador (sem instalar nada), ganhos por entrega sem mensalidade.

TAXAS: Cadastro GRATUITO. Taxa de entrega calculada por distancia. Sem mensalidade.

LINK CADASTRO: ` + CADASTRO_LINK + `

REGRAS: Seja simpatico e objetivo. Responda APENAS sobre FlashDrop. Respostas curtas (max 3 paragrafos). Emojis com moderacao. Nunca invente informacoes. Envie o link ao detectar interesse em cadastro.`;

setInterval(() => { const now=Date.now(); for(const [p,s] of conversations.entries()) if(now-s.lastActivity>SESSION_TTL) conversations.delete(p); }, 5*60*1000);

async function processMessage(phone, name, text) {
  try {
    if (!conversations.has(phone)) conversations.set(phone,{messages:[],lastActivity:Date.now()});
    const session = conversations.get(phone);
    session.lastActivity = Date.now();
    session.messages.push({role:'user',content:text});
    if (session.messages.length > MAX_HISTORY*2) session.messages = session.messages.slice(-MAX_HISTORY*2);
    const provider = process.env.AI_PROVIDER || 'claude';
    const response = provider==='claude' ? await callClaude(session.messages) : await callOpenAI(session.messages);
    session.messages.push({role:'assistant',content:response});
    return response;
  } catch(e) { console.error('[AI] Erro:',e.message); return 'Desculpe, problema tecnico. Tente novamente!'; }
}

async function callClaude(messages) {
  const r = await axios.post('https://api.anthropic.com/v1/messages',
    {model:'claude-3-5-haiku-20241022',max_tokens:1024,system:SYSTEM_PROMPT,messages},
    {headers:{'x-api-key':process.env.CLAUDE_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},timeout:30000});
  return r.data.content[0].text;
}

async function callOpenAI(messages) {
  const r = await axios.post('https://api.openai.com/v1/chat/completions',
    {model:'gpt-4o-mini',max_tokens:1024,messages:[{role:'system',content:SYSTEM_PROMPT},...messages]},
    {headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},timeout:30000});
  return r.data.choices[0].message.content;
}

module.exports = { processMessage };
