
const https = require('https');

const sessions = new Map();

const SYSTEM_PROMPT = `Você é o assistente virtual do FlashDrop, uma plataforma brasileira de delivery que conecta lojas locais a motoboys independentes. Seu nome é Flash.

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
2. Se perguntarem sobre outro assunto (política, futebol, etc.), redirecione gentilmente para o FlashDrop
3. Respostas curtas e diretas (máximo 3-4 parágrafos)
4. Use emojis com moderação (máximo 2-3 por mensagem)
5. Quando detectar interesse em se cadastrar, envie o link de cadastro
6. NUNCA invente informações que não estão neste prompt
7. Seja simpático, natural e profissional
8. Fale sempre em português brasileiro
9. Se o cliente já demonstrou interesse antes na conversa, seja mais direto e objetivo`;

function callClaude(messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return reject(new Error('CLAUDE_API_KEY não configurada'));
    }

    const body = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0] && parsed.content[0].text) {
            resolve(parsed.content[0].text);
          } else {
            reject(new Error('Resposta inesperada da API: ' + data));
          }
        } catch (e) {
          reject(new Error('Erro ao parsear resposta: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, []);
  }
  return sessions.get(from);
}

async function getAutoReply(from, message) {
  const history = getSession(from);

  history.push({ role: 'user', content: message });

  // Limitar histórico a 20 mensagens (10 trocas)
  if (history.length > 20) {
    history.splice(0, 2);
  }

  try {
    const reply = await callClaude([...history]);
    history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('Erro ao chamar Claude:', err.message);
    // Fallback se API falhar
    history.push({ role: 'assistant', content: 'Olá! Tive um probleminha técnico agora. Pode repetir sua mensagem? 😊' });
    return 'Olá! Tive um probleminha técnico agora. Pode repetir sua mensagem? 😊';
  }
}

module.exports = { getAutoReply };
