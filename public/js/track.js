// Tracker de analytics do Oferta Fit BR.
// Captura UTMs do Instagram, cria uma sessão anônima e envia eventos
// para /api/track (visitas, origem do tráfego e eventos do funil).
window.OFTrack = (() => {
  const KEY = 'of_sessao';
  const sessao = (() => {
    let s = localStorage.getItem(KEY);
    if (!s) {
      s = 's_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(KEY, s);
    }
    return s;
  })();

  const params = new URLSearchParams(location.search);
  const utm = {
    source: params.get('utm_source') || sessionStorage.getItem('of_utm_source'),
    medium: params.get('utm_medium') || sessionStorage.getItem('of_utm_medium'),
    campaign: params.get('utm_campaign') || sessionStorage.getItem('of_utm_campaign'),
    content: params.get('utm_content') || sessionStorage.getItem('of_utm_content'),
    term: params.get('utm_term') || sessionStorage.getItem('of_utm_term'),
  };
  if (utm.source) sessionStorage.setItem('of_utm_source', utm.source);
  if (utm.medium) sessionStorage.setItem('of_utm_medium', utm.medium);
  if (utm.campaign) sessionStorage.setItem('of_utm_campaign', utm.campaign);

  function enviar(tipo, extra = {}) {
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          pagina: location.pathname,
          sessao,
          utm,
          referrer: document.referrer || null,
          ...extra,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  // pageview da página atual
  enviar('pageview');
  if (location.pathname === '/' || location.pathname.endsWith('index.html')) enviar('lp_view');

  return { sessao, utm, enviar };
})();
