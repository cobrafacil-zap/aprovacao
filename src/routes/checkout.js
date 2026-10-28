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
import { mpAtivo, criarOrder } from '../lib/mercadopago.js';

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
  const { nome, email, metodo, utm, sessao, cartao } = req.body || {};
  if (!nome || !email?.includes('@')) return res.status(400).json({ error: 'preencha nome e e-mail válidos' });
  if (!['pix', 'cartao', 'boleto'].includes(metodo)) return res.status(400).json({ error: 'escolha a forma de pagamento' });
  if (metodo === 'cartao' && mpAtivo() && !cartao?.token) {
    return res.status(400).json({ error: 'dados do cartão não processados — tente novamente' });
  }
  if (metodo === 'boleto' && mpAtivo() && !req.body?.documento) {
    return res.status(400).json({ error: 'para emitir o boleto precisamos do seu CPF e endereço' });
  }

  const pedido = await novoPedido({ nome, email, metodo, utm });
  await track({ tipo: 'checkout_start', sessao, utm, pedidoId: pedido.id, valor: pedido.valor });

  // ---------- PRODUÇÃO: Orders API do Mercado Pago ----------
  if (mpAtivo()) {
    try {
      const [primeiro, ...resto] = String(nome).trim().split(' ');
      const resultado = await criarOrder({
        pedido,
        metodo,
        cartao,
        payer: {
          email,
          nome: primeiro,
          sobrenome: resto.join(' ') || primeiro,
          documento: req.body.documento,
          cep: req.body.cep,
          rua: req.body.rua,
          numero: req.body.numero,
          bairro: req.body.bairro,
          cidade: req.body.cidade,
          uf: req.body.uf,
        },
      });
      // importante: mutar e salvar a MESMA leitura (o banco relê o disco a cada read)
      const pedidosAtuais = await read('orders', []);
      const registro = pedidosAtuais.find((x) => x.id === pedido.id);
      if (registro) {
        registro.mpOrderId = resultado.mpOrderId;
        registro.mpStatus = resultado.mpStatus;
      }
      await write('orders', pedidosAtuais);

      return res.json({
        ok: true,
        pedido: { id: pedido.id, valor: pedido.valor, metodo, status: pedido.status },
        demo: false,
        pix: resultado.pix,
        boleto: resultado.boleto,
        cartao: metodo === 'cartao' ? { status: resultado.mpStatus, detalhe: resultado.mpStatusDetail } : null,
      });
    } catch (e) {
      console.error('[MP] falha ao criar order:', e.message);
      await write('orders', (await read('orders', [])).filter((p) => p.id !== pedido.id));
      return res.status(502).json({ error: 'Não foi possível gerar o pagamento no Mercado Pago. Tente novamente.' });
    }
  }

  // ---------- MODO DEMO ----------
  const demo = true;
  res.json({
    ok: true,
    pedido: { id: pedido.id, valor: pedido.valor, metodo, status: pedido.status },
    demo,
    pix: metodo === 'pix' ? { copiaECola: pixCopiaECola(pedido), qrBase64: null, link: null } : null,
    boleto: metodo === 'boleto' ? { linhaDigitavel: '34191.79001 01043.510047 91020.150008 9 99990000001990', link: null } : null,
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

// Webhook Mercado Pago (Orders API / Payments API).
// A MP envia apenas o ID do pagamento — o status real é CONFIRMADO consultando
// a API, para nunca liberar acesso por payload forjado.
// Proteção adicional: configure MP_WEBHOOK_SECRET e use a URL
//   https://seudominio.com/api/checkout/webhook?token=SEGREDO
router.post('/webhook', async (req, res) => {
  try {
    const segredo = process.env.MP_WEBHOOK_SECRET;
    if (segredo && req.query.token !== segredo) {
      return res.status(401).json({ error: 'token inválido' });
    }

    const body = req.body || {};
    console.log('[WEBHOOK]', JSON.stringify(body).slice(0, 300));

    // formato webhook (type/data.id) e IPN antigo (topic/data.id na query)
    const recursoId = body?.data?.id || req.query['data.id'] || req.body?.id || req.body?.pedidoId;
    const tipo = body.type || req.query.topic || (body.action || '').split('.')[0];

    if (process.env.MP_ACCESS_TOKEN && recursoId && (tipo === 'payment' || tipo === 'order' || tipo === 'merchant_order')) {
      const pagamento = await consultarPagamentoMP(recursoId);
      const pedidoId = pagamento?.external_reference;
      const status = pagamento?.status; // approved | pending | rejected ...
      if (pedidoId && status === 'approved') {
        const pedidos = await read('orders', []);
        const p = pedidos.find((x) => x.id === pedidoId);
        if (p && p.status !== 'pago') await aprovarPedido(p, pedidos);
      }
      return res.json({ ok: true, consultado: recursoId, status });
    }

    // modo demo / payloads de teste: aceita external_reference + status direto
    const pedidoId = body.external_reference || body.pedidoId;
    const status = body.status || (body.type === 'payment' ? 'approved' : null);
    if (pedidoId && status === 'approved') {
      const pedidos = await read('orders', []);
      const p = pedidos.find((x) => x.id === pedidoId);
      if (p && p.status !== 'pago') await aprovarPedido(p, pedidos);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[WEBHOOK] erro:', e.message);
    res.json({ ok: true }); // responde 200 para a MP não reenviar em loop
  }
});

// Consulta o status REAL do pagamento na API do Mercado Pago (Orders/Payments).
async function consultarPagamentoMP(id) {
  const token = process.env.MP_ACCESS_TOKEN;
  const headers = { Authorization: `Bearer ${token}` };
  // Orders API primeiro; se não achar, tenta a Payments API (legacy)
  for (const url of [
    `https://api.mercadopago.com/v1/orders/${id}`,
    `https://api.mercadopago.com/v1/payments/${id}`,
  ]) {
    try {
      const r = await fetch(url, { headers });
      if (r.ok) {
        const d = await r.json();
        // Orders: status em transactions.payments[]; Payments: status direto
        const pagamento = d?.transactions?.payments?.[0] || d;
        return {
          status: pagamento.status || d.status,
          external_reference: d.external_reference || pagamento.external_reference,
        };
      }
    } catch {}
  }
  return null;
}

export default router;
