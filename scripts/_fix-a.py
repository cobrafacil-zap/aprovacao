#!/usr/bin/env python3
# Correções de segurança e operação da auditoria de 02/11.
def aplicar(p, pares):
    t = open(p).read()
    for a, b in pares:
        if a not in t:
            print('  ! nao achou em', p, ':', a[:64])
        t = t.replace(a, b)
    open(p, 'w').write(t)
    print('ok:', p)

# ---------- S2: demo nunca roda em produção ----------
aplicar('src/routes/checkout.js', [
  ("""router.post('/pedidos/:id/aprovar', async (req, res) => {
  if (mpAtivo()) return res.status(403).json({ error: 'indisponível com pagamentos ativos' });""",
   """router.post('/pedidos/:id/aprovar', async (req, res) => {
  // demo é só para desenvolvimento: em produção (com ou sem MP) não existe
  if (mpAtivo() || process.env.VERCEL_ENV === 'production') {
    return res.status(403).json({ error: 'indisponível com pagamentos ativos' });
  }"""),
  ("""    // modo demo / payloads de teste: aceita external_reference + status direto
    // BLOQUEADO quando há pagamento real: só o Mercado Pago pode confirmar
    if (mpAtivo()) return res.json({ ok: true });""",
   """    // modo demo / payloads de teste: aceita external_reference + status direto
    // BLOQUEADO em produção: só o Mercado Pago pode confirmar um pagamento
    if (mpAtivo() || process.env.VERCEL_ENV === 'production') return res.json({ ok: true });"""),
  # S6: rate limit na consulta de pedido e no aprovar demo
  ("""router.get('/pedidos/:id', async (req, res) => {""",
   """router.get('/pedidos/:id', limite({ max: 60, janelaMs: 60 * 1000 }), async (req, res) => {"""),
  ("""router.post('/pedidos/:id/aprovar', async (req, res) => {""",
   """router.post('/pedidos/:id/aprovar', limite({ max: 20, janelaMs: 5 * 60 * 1000 }), async (req, res) => {"""),
  # S3: aprovação relê o pedido do banco em vez de gravar array velho
  ("""async function aprovarPedido(pedido, pedidos) {
  // idempotente: se já foi pago, ou outra chamada já está aprovando, não repete
  // (webhook e polling podem chegar ao mesmo tempo)
  if (pedido.status === 'pago') return pedido;
  if (!(await setNx(`of:aprovando:${pedido.id}`, 120))) return pedido;
  pedido.status = 'pago';
  pedido.pagoEm = agora();
  pedido.acessoLiberado = true;
  await write('orders', pedidos);""",
   """async function aprovarPedido(pedidoRef) {
  // idempotente: se já foi pago, ou outra chamada já está aprovando, não repete
  // (webhook e polling podem chegar ao mesmo tempo)
  if (pedidoRef.status === 'pago') return pedidoRef;
  if (!(await setNx(`of:aprovando:${pedidoRef.id}`, 120))) return pedidoRef;

  // relê o banco na hora do commit: grava o array ATUAL, nunca uma cópia velha
  // (senão um pedido criado durante a aprovação some)
  const pedidos = await read('orders', []);
  const pedido = pedidos.find((x) => x.id === pedidoRef.id);
  if (!pedido) return pedidoRef;
  if (pedido.status === 'pago') return pedido;
  pedido.status = 'pago';
  pedido.pagoEm = agora();
  pedido.acessoLiberado = true;
  await write('orders', pedidos);"""),
  # S8: falha do analytics nunca derruba o envio dos e-mails pós-compra
  ("""  await track({ tipo: 'purchase', pedidoId: pedido.id, valor: pedido.valor, utm: pedido.utm, origem: 'checkout' });""",
   """  await track({ tipo: 'purchase', pedidoId: pedido.id, valor: pedido.valor, utm: pedido.utm, origem: 'checkout' })
    .catch((e) => console.error('[TRACK] purchase:', e.message));"""),
  # O4: polling cobre também pedido marcado como abandonado (boleto pago depois)
  ("""  if (p.status === 'aguardando' && p.mpOrderId && mpAtivo()) {""",
   """  if ((p.status === 'aguardando' || p.status === 'abandonado') && p.mpOrderId && mpAtivo()) {"""),
  # O5: timeout nas chamadas externas
  ("""  for (const url of [
    `https://api.mercadopago.com/v1/orders/${id}`,
    `https://api.mercadopago.com/v1/payments/${id}`,
  ]) {
    try {
      const r = await fetch(url, { headers });""",
   """  for (const url of [
    `https://api.mercadopago.com/v1/orders/${id}`,
    `https://api.mercadopago.com/v1/payments/${id}`,
  ]) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });"""),
])

# ---------- S7: rate limit por cliente real atrás do proxy ----------
aplicar('src/app.js', [
  ("app.use(express.json({ limit: '2mb' }));",
   "app.set('trust proxy', 1); // atrás da Vercel: req.ip vira o IP real do visitante\napp.use(express.json({ limit: '2mb' }));"),
])

# ---------- S9 + S12: config validada e sem segredos ----------
aplicar('src/routes/admin.js', [
  ("""router.get('/config', async (req, res) => {
  const s = { ...(await read('settings', {})) };
  delete s.adminSenha;
  delete s.adminSenhaHash;
  delete s.adminSenhaSalt;
  res.json({ config: s });
});""",
   """router.get('/config', async (req, res) => {
  const s = { ...(await read('settings', {})) };
  delete s.adminSenha;
  delete s.adminSenhaHash;
  delete s.adminSenhaSalt;
  delete s.emailsSegredo; // segredo interno: não volta para o navegador
  res.json({ config: s });
});"""),
  ("""router.put('/config', async (req, res) => {
  const s = await read('settings', {});
  const b = req.body || {};
  ['nomeProduto', 'preco', 'precoAntigo', 'garantiaDias', 'emailSuporte', 'diaLiberacao', 'fraseRodape'].forEach((k) => {
    if (b[k] !== undefined) s[k] = b[k];
  });""",
   """router.put('/config', async (req, res) => {
  const s = await read('settings', {});
  const b = req.body || {};
  // tipos conferidos: preço numérico e textos limitados, sem injeção de objeto
  for (const k of ['preco', 'precoAntigo', 'garantiaDias']) {
    if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} inválido` });
      s[k] = n;
    }
  }
  for (const k of ['nomeProduto', 'emailSuporte', 'diaLiberacao', 'fraseRodape']) {
    if (b[k] !== undefined) {
      if (typeof b[k] !== 'string' || b[k].length > 200) return res.status(400).json({ error: `${k} inválido` });
      s[k] = b[k];
    }
  }"""),
  # S4/O1: publicar continua de onde parou e não estoura o limite da função
  ("const { enviados, pendentes } = await enviarAvisosDeNovaReceita(r, { maxPorChamada: 200 });",
   "const { enviados, pendentes } = await enviarAvisosDeNovaReceita(r, { maxPorChamada: 40 });"),
])

# ---------- S11: cookie malformado não explode ----------
aplicar('src/lib/auth.js', [
  ("""  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });""",
   """  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) {
      try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }
      catch { out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
    }
  });"""),
])
