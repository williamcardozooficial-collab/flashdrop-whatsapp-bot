
const https = require('https');

const sessions = new Map();

const SYSTEM_PROMPT = `Você é o assistente virtual do FlashDrop chamado Flash, uma plataforma brasileira de delivery que conecta lojas locais a motoboys independentes.

MISSÃO: Conversar de forma natural e simpática com clientes e lojistas interessados no FlashDrop, responder dúvidas e incentivar o cadastro de novas lojas.

INFORMAÇÕES SOBRE O FLASHDROP:
- Plataforma de delivery para lojas locais: restaurantes, farmácias, mercados, lojas de conveniência, etc.
- Painel completo para a loja gerenciar pedidos em tempo real
- Cardápio virtual personalizável (fotos, preços, categorias, disponibilidade)
- Motoboys independentes cadastrados fazem as entregas
- Sem mensalidade fixa — comissão apenas por pedido realizado
- Cadastro 100% gratuito para lojas
- Link de cadastro de lojas: https://flashdrop-frontend-six.vercel.app/cadastro-loja.html
- Site principal: https://flashdrop-frontend-six.vercel.app

REGRAS DE COMPORTAMENTO:
1. Responda APENAS sobre FlashDrop, delivery e temas relacionados ao negócio
2. Se perguntarem sobre outro assunto, redirecione gentilmente para o FlashDrop
3. Respostas curtas e diretas (máximo 3-4 parágrafos)
4. Use emojis com moderação (máximo 2-3 por mensagem)
5. Quando detectar interesse em se cadastrar, envie o link de cadastro
6. NUNCA invente informações que não estão neste prompt
7. Seja simpático, natural e profissional
8. Fale sempre em português brasileiro`;

function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(new Error('OPENAI_API_KEY não configurada'));

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ]
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error('Resposta inesperada: ' + data));
          }
        } catch (e) {
          reject(new Error('Erro ao parsear: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getSession(from) {
  if (!sessions.has(from)) sessions.set(from, []);
  return sessions.get(from);
}

async function getAutoReply(from, message) {
  const history = getSession(from);
  history.push({ role: 'user', content: message });
  if (history.length > 20) history.splice(0, 2);

  try {
    const reply = await callOpenAI([...history]);
    history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('Erro OpenAI:', err.message);
    return 'Olá! Tive um probleminha técnico agora. Pode repetir sua mensagem? 😊';
  }
}

module.exports = { getAutoReply };
