// Analytics próprio (sem cookie de terceiros).
// Registra eventos crus em data/events.json e agrega sob demanda:
// visitas, conversão da página, checkouts abandonados, vendas e origem do tráfego.
import { read, write, id, agora } from './db.js';

export function track(evt) {
  const eventos = read('events', []);
  eventos.push({
    id: id('evt'),
    ts: agora(),
    sessao: evt.sessao || null,
    tipo: evt.tipo || evt.type || 'evento',
    pagina: evt.pagina || null,
    utm: evt.utm || null,
    referrer: evt.referrer || null,
    valor: evt.valor ?? null,
    pedidoId: evt.pedidoId || null,
    receitaId: evt.receitaId || null,
    origem: evt.origem || 'site',
    dispositivo: evt.dispositivo || null,
  });
  // guarda só os últimos 100k eventos para o arquivo não crescer sem limite
  write('events', eventos.slice(-100000));
}

const dia = (ts) => String(ts).slice(0, 10);
const noPeriodo = (ts, de, ate) => (!de || ts >= de) && (!ate || ts <= ate);

export function resumo({ de, ate, dias = 14 } = {}) {
  const eventos = read('events', []).filter((e) => noPeriodo(dia(e.ts), de, ate));
  const pedidos = read('orders', []).filter((p) => noPeriodo(dia(p.criadoEm), de, ate));

  const pageviews = eventos.filter((e) => e.tipo === 'pageview');
  const sessoes = new Set(pageviews.map((e) => e.sessao).filter(Boolean));
  const visitas = sessoes.size || pageviews.length;
  const lp = new Set(eventos.filter((e) => e.tipo === 'lp_view').map((e) => e.sessao).filter(Boolean)).size || eventos.filter((e) => e.tipo === 'lp_view').length;
  const inicios = new Set(eventos.filter((e) => e.tipo === 'checkout_start').map((e) => e.sessao).filter(Boolean)).size || eventos.filter((e) => e.tipo === 'checkout_start').length;
  const pagos = pedidos.filter((p) => p.status === 'pago');
  const abandonados = pedidos.filter((p) => p.status === 'abandonado');

  const receita = pagos.reduce((s, p) => s + (p.valor || 0), 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  // série diária (últimos N dias) para gráficos
  const hoje = new Date();
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 864e5).toISOString().slice(0, 10);
    serie.push({
      data: d,
      visitas: new Set(pageviews.filter((e) => dia(e.ts) === d).map((e) => e.sessao).filter(Boolean)).size || pageviews.filter((e) => dia(e.ts) === d).length,
      checkouts: eventos.filter((e) => e.tipo === 'checkout_start' && dia(e.ts) === d).length,
      vendas: pedidos.filter((p) => p.status === 'pago' && dia(p.criadoEm) === d).length,
      receita: pedidos.filter((p) => p.status === 'pago' && dia(p.criadoEm) === d).reduce((s, p) => s + (p.valor || 0), 0),
    });
  }

  // origem do tráfego (utm_source ou referrer)
  const origens = {};
  pageviews.forEach((e) => {
    const o = (e.utm?.source || (e.referrer ? new URL(e.referrer, 'https://x').hostname.replace('www.', '') : 'direto')).toLowerCase();
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
    eventos_recentes: read('events', []).slice(-30).reverse(),
  };
}
