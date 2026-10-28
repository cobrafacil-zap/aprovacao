// Mercado Pago — Orders API (Checkout Transparente).
// Esquema validado AO VIVO contra a API (out/2026):
//   POST /v1/orders { type, external_reference, total_amount, payer, transactions.payments[] }
//   payment_method: { id: 'pix', type: 'bank_transfer' }                 → qr_code / qr_code_base64 / ticket_url
//   payment_method: { id: 'bolbradesco', type: 'ticket' }                → ticket_url (payer exige CPF + endereço)
//   payment_method: { id: '<bandeira>', type: 'credit_card', token, installments }
// Sem MP_ACCESS_TOKEN, o checkout segue em modo demo (simulado).

const API = 'https://api.mercadopago.com';
export const mpAtivo = () => !!process.env.MP_ACCESS_TOKEN;

async function mp(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${path}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let dados;
  try { dados = JSON.parse(text); } catch { dados = { raw: text }; }
  if (!r.ok) {
    const detalhe = JSON.stringify(dados).slice(0, 400);
    throw new Error(`Mercado Pago (${r.status}): ${detalhe}`);
  }
  return dados;
}

// Cria a order e devolve os dados de pagamento por método.
export async function criarOrder({ pedido, metodo, payer, cartao }) {
  const paymentMethod =
    metodo === 'pix'
      ? { id: 'pix', type: 'bank_transfer' }
      : metodo === 'boleto'
        ? { id: 'bolbradesco', type: 'ticket' }
        : {
            id: cartao.bandeira, // ex.: visa, master
            type: 'credit_card',
            token: cartao.token,
            installments: cartao.parcelas || 1,
          };

  const pagamento = {
    amount: String(pedido.valor.toFixed(2)),
    payment_method: paymentMethod,
  };

  const order = await mp('POST', '/v1/orders', {
    type: 'online',
    external_reference: pedido.id,
    total_amount: String(pedido.valor.toFixed(2)),
    payer: montarPayer(payer),
    transactions: { payments: [pagamento] },
  });

  const pm = order?.transactions?.payments?.[0]?.payment_method || {};
  return {
    mpOrderId: order.id,
    mpStatus: order.status, // action_required | pending | approved | ...
    mpStatusDetail: order.status_detail,
    pix: metodo === 'pix'
      ? { copiaECola: pm.qr_code, qrBase64: pm.qr_code_base64, link: pm.ticket_url }
      : null,
    boleto: metodo === 'boleto'
      ? { link: pm.ticket_url, linhaDigitavel: pm.barcode || null }
      : null,
  };
}

function montarPayer(payer = {}) {
  const base = { email: payer.email };
  if (payer.nome) base.first_name = payer.nome;
  if (payer.sobrenome) base.last_name = payer.sobrenome;
  if (payer.documento) {
    base.identification = {
      type: payer.documento.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
      number: payer.documento.replace(/\D/g, ''),
    };
  }
  if (payer.rua) {
    base.address = {
      zip_code: (payer.cep || '').replace(/\D/g, ''),
      street_name: payer.rua,
      street_number: payer.numero || 's/n',
      neighborhood: payer.bairro || 'Centro',
      city: payer.cidade || '',
      state: (payer.uf || '').toUpperCase(),
    };
  }
  return base;
}

// A Orders API usa outro vocabulário de status que a Payments API:
// processed/accredited = pago (além de approved, da API legada).
export function estaPago(status, statusDetail) {
  const s = String(status || '').toLowerCase();
  const d = String(statusDetail || '').toLowerCase();
  return ['approved', 'processed', 'accredited'].includes(s) || d === 'accredited';
}

// Consulta o estado real da order (usado pelo webhook e pelo polling do checkout).
export async function consultarOrder(orderId) {
  const o = await mp('GET', `/v1/orders/${orderId}`);
  const pagamento = o?.transactions?.payments?.[0] || {};
  return {
    status: pagamento.status || o.status,
    statusDetail: pagamento.status_detail || o.status_detail,
    externalReference: o.external_reference,
  };
}

export async function cancelarOrder(orderId) {
  try {
    return await mp('PUT', `/v1/orders/${orderId}/cancel`);
  } catch (e) {
    return { erro: e.message };
  }
}
