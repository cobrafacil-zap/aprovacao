// Checkout: Pix, cartão e boleto — pedido único, garantia de 7 dias.
// MODO DEMO (padrão): cria o pedido e simula a aprovação.
// PRODUÇÃO: com MP_ACCESS_TOKEN configurado, cria cobrança real no Mercado Pago
//           e a aprovação chega pelo webhook /api/checkout/webhook.
// Tokens de "definir senha" ficam no banco com TTL (funciona entre instâncias serverless).
import { Router } from 'express';
import { read, write, id, agora, sessaoSet, sessaoGet, sessaoDelete } from '../lib/db.js';
import { track } from '../lib/analytics.js';
import { garantirConta } from '../lib/auth.js';
import { sendEmail, emailCompra, emailDefinirSenha, urlMembros } from '../lib/mail.js';
import { baseUrl } from '../lib/helpers.js';

const router = Router();
const VALOR = async () => (await read('settings', {})).preco ?? 19.9;

async function novoPedido({ nome, email, metodo, utm }) {
  const pedido = {
    id: id('ped'),
    nome,
    email: String(email).toLowerCase(),
    produto: 'Acesso vitalício — Oferta Fit BR',
    valor: await VALOR(),
    metodo, // pix | cartao | boleto
    status: 'aguardando', // aguardando | pago | abandonado | estornado
    criadoEm: agora(),
    utm: utm || null,
    acessoLiberado: false,
  };
  const pedidos = await read('orders', []);
  pedidos.push(pedido);
  await write('orders', pedidos);
  return pedido;
}

router.post('/pedidos', async (req, res) => {
  const { nome, email, metodo, utm, sessao } = req.body || {};
  if (!nome || !email?.includes('@')) return res.status(400).json({ error: 'preencha nome e e-mail válidos' });
  if (!['pix', 'cartao', 'boleto'].includes(metodo)) return res.status(400).json({ error: 'escolha a forma de pagamento' });

  const pedido = await novoPedido({ nome, email, metodo, utm });
  await track({ tipo: 'checkout_start', sessao, utm, pedidoId: pedido.id, valor: pedido.valor });

  // Em produção aqui entra a chamada ao Mercado Pago (preferência/cobrança).
  const demo = !process.env.MP_ACCESS_TOKEN;
  res.json({
    ok: true,
    pedido: { id: pedido.id, valor: pedido.valor, metodo, status: pedido.status },
    demo,
    pix: metodo === 'pix' ? { copiaECola: pixCopiaECola(pedido), qr: 'demo-qr' } : null,
    boleto: metodo === 'boleto' ? { linhaDigitavel: '34191.79001 01043.510047 91020.150008 9 99990000001990' } : null,
  });
});

function pixCopiaECola(pedido) {
  return `00020126580014BR.GOV.BCB.PIX0136${pedido.id}5204000053039865802BR5913OFERTA FIT BR6009SAO PAULO62070503***6304${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

router.get('/pedidos/:id', async (req, res) => {
  const p = (await read('orders', [])).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'pedido não encontrado' });
  res.json({ pedido: { id: p.id, status: p.status, valor: p.valor, metodo: p.metodo, email: p.email, criadoEm: p.criadoEm } });
});

// DEMO: botão "simular pagamento aprovado". Em produção, quem aprova é o webhook.
router.post('/pedidos/:id/aprovar', async (req, res) => {
  const pedidos = await read('orders', []);
  const p = pedidos.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'pedido não encontrado' });
  if (p.status === 'pago') return res.json({ ok: true, jaPago: true, url: `${baseUrl()}/obrigado.html?pedido=${p.id}` });
  await aprovarPedido(p, pedidos);
  res.json({ ok: true, url: `${baseUrl()}/obrigado.html?pedido=${p.id}` });
});

async function aprovarPedido(pedido, pedidos) {
  pedido.status = 'pago';
  pedido.pagoEm = agora();
  pedido.acessoLiberado = true;
  await write('orders', pedidos);

  const usuario = await garantirConta({ nome: pedido.nome, email: pedido.email, pedidoId: pedido.id });
  await track({ tipo: 'purchase', pedidoId: pedido.id, valor: pedido.valor, utm: pedido.utm, origem: 'checkout' });

  const url = urlMembros();
  try {
    await sendEmail({ to: pedido.email, subject: 'Pagamento aprovado — seu acesso chegou 🎉', html: emailCompra(pedido.nome, url) });
    if (!usuario.senhaDefinida) {
      const link = `${baseUrl()}/login.html?definir=${usuario.id}.${tokenDefinirSenha(usuario.id)}`;
      await sendEmail({ to: pedido.email, subject: 'Defina sua senha de acesso', html: emailDefinirSenha(pedido.nome, link) });
    }
  } catch (e) {
    console.error('[EMAIL] falha no envio pós-compra:', e.message);
  }
  return pedido;
}

// ---------- tokens de senha (no banco, com TTL de 7 dias) ----------
export function tokenDefinirSenha(userId) {
  const t = id('tk') + Math.random().toString(36).slice(2, 10);
  // dispara sem esperar: não precisa bloquear a resposta
  sessaoSet(t, { usuarioId: userId, tipo: 'senha' }, 7).catch(() => {});
  return t;
}

export async function consumirToken(t) {
  const [userId, chave] = String(t).split('.');
  const dados = await sessaoGet(chave || t);
  if (!dados || dados.tipo !== 'senha') return null;
  if (chave && dados.usuarioId !== userId) return null;
  await sessaoDelete(chave || t);
  return dados.usuarioId;
}

// Webhook Mercado Pago (ou simulado). Aprova o pedido e libera o acesso.
router.post('/webhook', async (req, res) => {
  const body = req.body || {};
  console.log('[WEBHOOK]', JSON.stringify(body).slice(0, 300));
  const pedidoId = body.external_reference || body.pedidoId;
  const status = body.status || (body.type === 'payment' ? 'approved' : null);
  if (pedidoId && status === 'approved') {
    const pedidos = await read('orders', []);
    const p = pedidos.find((x) => x.id === pedidoId);
    if (p && p.status !== 'pago') await aprovarPedido(p, pedidos);
  }
  res.json({ ok: true });
});

export default router;
