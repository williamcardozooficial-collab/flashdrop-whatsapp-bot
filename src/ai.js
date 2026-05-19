
const sessions = new Map();

const SYSTEM_PROMPT = `Você é o assistente virtual do FlashDrop, uma plataforma de delivery que conecta lojas locais a motoboys independentes.

MISSÃO: Responder dúvidas sobre o FlashDrop e incentivar o cadastro de novas lojas.

SOBRE O FLASHDROP:
- Plataforma de delivery para lojas locais (restaurantes, farmácias, mercados, etc.)
- A loja tem um painel completo para gerenciar pedidos
- Cardápio virtual personalizável
- Motoboys independentes cadastrados na plataforma fazem as entregas
- Sem mensalidade fixa - comissão apenas por pedido realizado
- Cadastro gratuito para lojas: https://flashdrop-frontend-six.vercel.app/cadastro-loja.html
- Site: https://flashdrop-frontend-six.vercel.app

REGRAS:
1. Responda APENAS sobre FlashDrop e delivery
2. Se perguntarem sobre outro assunto, redirecione gentilmente para o tema
3. Respostas curtas, máximo 3-4 parágrafos
4. Use emojis com moderação (máximo 2-3 por mensagem)
5. Quando detectar interesse em cadastrar, envie o link de cadastro
6. NUNCA invente informações que não estão neste prompt
7. Seja simpático e profissional`;

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, []);
  }
  return sessions.get(from);
}

async function getAutoReply(from, message) {
  const history = getSession(from);
  
  history.push({ role: 'user', content: message });
  
  // Limitar histórico a 10 mensagens
  if (history.length > 20) {
    history.splice(0, 2);
  }

  // Resposta automática baseada em regras simples (sem API externa)
  const msg = message.toLowerCase();
  
  let reply = null;

  if (msg.includes('oi') || msg.includes('olá') || msg.includes('ola') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite') || msg.includes('hello')) {
    reply = `Olá! 👋 Seja bem-vindo ao FlashDrop!\n\nSou o assistente virtual do FlashDrop, a plataforma que conecta lojas locais a motoboys para entregas rápidas.\n\nPosso te ajudar com:\n• Como funciona o FlashDrop\n• Cadastro de lojas\n• Informações sobre entregas\n• Painel da loja\n\nO que você gostaria de saber? 😊`;
  } else if (msg.includes('cadastr') || msg.includes('registr') || msg.includes('criar conta') || msg.includes('quero participar') || msg.includes('quero entrar')) {
    reply = `Ótimo! 🎉 Para cadastrar sua loja no FlashDrop é simples e gratuito!\n\nAcesse o link de cadastro:\n👉 https://flashdrop-frontend-six.vercel.app/cadastro-loja.html\n\nApós o cadastro, você terá acesso ao painel completo para gerenciar seus pedidos, cardápio e muito mais!\n\nTem alguma dúvida sobre o processo?`;
  } else if (msg.includes('como funciona') || msg.includes('o que é') || msg.includes('me fala') || msg.includes('me conta') || msg.includes('informação') || msg.includes('informacao')) {
    reply = `O FlashDrop é uma plataforma de delivery para lojas locais! 🚀\n\nVeja como funciona:\n1️⃣ Sua loja se cadastra gratuitamente\n2️⃣ Você monta seu cardápio virtual\n3️⃣ Clientes fazem pedidos pelo app\n4️⃣ Motoboys cadastrados fazem a entrega\n\nVocê controla tudo pelo painel da loja: pedidos, cardápio, histórico e muito mais. Sem mensalidade fixa!\n\nQuer saber mais ou se cadastrar?`;
  } else if (msg.includes('motoboy') || msg.includes('entrega') || msg.includes('entregador')) {
    reply = `No FlashDrop, as entregas são feitas por motoboys independentes cadastrados na plataforma! 🏍️\n\nCada pedido é atribuído ao motoboy disponível mais próximo, garantindo entregas rápidas e eficientes.\n\nSua loja não precisa ter motoboy próprio - nós cuidamos disso! Quer saber como cadastrar sua loja?`;
  } else if (msg.includes('painel') || msg.includes('dashboard') || msg.includes('sistema') || msg.includes('gerenciar')) {
    reply = `O painel da loja no FlashDrop é completo! 📱\n\nFuncionalidades:\n✅ Gerenciamento de pedidos em tempo real\n✅ Cardápio virtual personalizável\n✅ Histórico de vendas\n✅ Controle de motoboys\n✅ Interface simples e fácil de usar\n\nTudo online, sem instalar nada! Quer se cadastrar?`;
  } else if (msg.includes('preço') || msg.includes('preco') || msg.includes('valor') || msg.includes('custo') || msg.includes('taxa') || msg.includes('mensalidade') || msg.includes('gratis') || msg.includes('gratuito')) {
    reply = `O cadastro no FlashDrop é GRATUITO! 🎉\n\nNão cobramos mensalidade fixa. Trabalhamos com uma pequena comissão por pedido realizado, ou seja, você só paga quando vende!\n\nÉ a forma mais justa de crescer o seu negócio. Quer se cadastrar agora?\n👉 https://flashdrop-frontend-six.vercel.app/cadastro-loja.html`;
  } else if (msg.includes('link') || msg.includes('site') || msg.includes('endereço') || msg.includes('endereco') || msg.includes('acesso')) {
    reply = `Aqui estão os links do FlashDrop: 🔗\n\n🏪 Cadastro de lojas:\nhttps://flashdrop-frontend-six.vercel.app/cadastro-loja.html\n\n🌐 Site principal:\nhttps://flashdrop-frontend-six.vercel.app\n\nQualquer dúvida, é só perguntar!`;
  } else if (msg.includes('obrigad') || msg.includes('valeu') || msg.includes('ok') || msg.includes('certo') || msg.includes('entendi')) {
    reply = `De nada! 😊 Fico feliz em ajudar!\n\nSe tiver mais dúvidas sobre o FlashDrop, é só chamar. Até mais! 👋`;
  } else {
    reply = `Olá! Sou o assistente do FlashDrop, a plataforma de delivery para lojas locais. 😊\n\nPosso te ajudar com informações sobre:\n• Como funciona o FlashDrop\n• Cadastro gratuito de lojas\n• Sistema de entregas com motoboys\n• Painel de gerenciamento\n\nO que você gostaria de saber?`;
  }

  history.push({ role: 'assistant', content: reply });
  return reply;
}

module.exports = { getAutoReply };
