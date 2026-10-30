// Analytics próprio (sem cookies de terceiros).
// Cada evento custa ~1 comando Redis (LPUSH); a agregação é feita sob demanda
// no painel admin: visitas, conversão da página, checkouts abandonados,
// vendas e origem do tráfego.
import { eventoAdd, eventoLista, read, id, agora } from './db.js';

// tudo que vem do navegador é tratado como dado não confiável:
// limita tamanho e apaga qualquer marcação de HTML
const seguro = (v, max = 80) =>
  String(v || '').slice(0, max).replace(/[<>&"'`\\]/g, '');

function utmSeguro(utm) {
  if (!utm || typeof utm !== 'object') return null;
  const out = {};
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
    if (utm[k]) out[k] = seguro(utm[k], 60).toLowerCase();
  }
  return Object.keys(out).length ? out : null;
}

const referrerSeguro = (r) => {
  const s = seguro(r, 200);
  if (!s) return null;
  try { return new URL(s).host.slice(0, 80); } catch { return null; }
};

export async function track(evt) {
  await eventoAdd({
    id: id('evt'),
    ts: agora(),
    sessao: seguro(evt.sessao, 40) || null,
    tipo: seguro(evt.tipo || evt.type || 'evento', 30),
    pagina: seguro(evt.pagina, 120) || null,
    utm: utmSeguro(evt.utm),
    referrer: referrerSeguro(evt.referrer),
    valor: Number(evt.valor) || null,
    pedidoId: seguro(evt.pedidoId, 40) || null,
    receitaId: seguro(evt.receitaId, 40) || null,
    origem: seguro(evt.origem, 20) || 'site',
    dispositivo: seguro(evt.dispositivo, 20) || null,
  });
}

// agrupa por dia no fuso de São Paulo (o negócio é UTC-3)
const dia = (ts) => new Date(new Date(ts).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const noPeriodo = (ts, de, ate) => (!de || ts >= de) && (!ate || ts <= ate);

export async function resumo({ de, ate, dias = 14 } = {}) {
  const [todosEventos, pedidos] = await Promise.all([
    eventoLista(5000),
    read('orders', []),
  ]);
  const eventos = todosEventos.filter((e) => noPeriodo(dia(e.ts), de, ate));
  const pedidosP = pedidos.filter((p) => noPeriodo(dia(p.criadoEm), de, ate));

  const pageviews = eventos.filter((e) => e.tipo === 'pageview');
  const sessoes = new Set(pageviews.map((e) => e.sessao).filter(Boolean));
  const visitas = sessoes.size || pageviews.length;
  const lp = new Set(eventos.filter((e) => e.tipo === 'lp_view').map((e) => e.sessao).filter(Boolean)).size ||
    eventos.filter((e) => e.tipo === 'lp_view').length;
  const inicios = new Set(eventos.filter((e) => e.tipo === 'checkout_start').map((e) => e.sessao).filter(Boolean)).size ||
    eventos.filter((e) => e.tipo === 'checkout_start').length;
  const pagos = pedidosP.filter((p) => p.status === 'pago');
  const abandonados = pedidosP.filter((p) => p.status === 'abandonado');

  const receita = pagos.reduce((s, p) => s + (p.valor || 0), 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  const hoje = new Date();
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 864e5).toISOString().slice(0, 10);
    serie.push({
      data: d,
      visitas: new Set(pageviews.filter((e) => dia(e.ts) === d).map((e) => e.sessao).filter(Boolean)).size ||
        pageviews.filter((e) => dia(e.ts) === d).length,
      checkouts: eventos.filter((e) => e.tipo === 'checkout_start' && dia(e.ts) === d).length,
      vendas: pedidosP.filter((p) => p.status === 'pago' && dia(p.criadoEm) === d).length,
      receita: pedidosP.filter((p) => p.status === 'pago' && dia(p.criadoEm) === d).reduce((s, p) => s + (p.valor || 0), 0),
    });
  }

  const origens = {};
  pageviews.forEach((e) => {
    let o = 'direto';
    if (e.utm?.source) o = String(e.utm.source).toLowerCase();
    else if (e.referrer) {
      try { o = new URL(e.referrer, 'https://x').hostname.replace('www.', '').toLowerCase(); } catch {}
    }
    origens[o] = (origens[o] || 0) + 1;
  });

  const dispositivos = {};
  eventos.forEach((e) => {
    const d = e.dispositivo || 'desconhecido';
    dispositivos[d] = (dispositivos[d] || 0) + 1;
  });

  return {
    periodo: { de: de || serie[0].data, ate: ate || serie[serie.length - 1].data },
    visitas,
    lp_views: lp,
    checkouts_iniciados: inicios,
    checkouts_abandonados: abandonados.length,
    vendas: pagos.length,
    receita: Math.round(receita * 100) / 100,
    ticket_medio: pagos.length ? Math.round((receita / pagos.length) * 100) / 100 : 0,
    conversao_pagina: pct(inicios, lp || visitas),
    conversao_vendas: pct(pagos.length, lp || visitas),
    abandono_checkout: pct(abandonados.length, inicios),
    serie,
    origens: Object.entries(origens).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
    dispositivos: Object.entries(dispositivos).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
    eventos_recentes: todosEventos.slice(-30).reverse(),
  };
}
