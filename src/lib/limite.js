// Limite de requisições simples em memória (por instância serverless).
// Não substitui um WAF, mas derruba força bruta e spam de e-mail/pedidos.
const janelas = new Map(); // chave -> { n, inicio }

export function limite({ chave = (req) => req.ip, max = 20, janelaMs = 5 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const k = `${chave(req)}|${req.path}`;
    const agoraTs = Date.now();
    const j = janelas.get(k);
    if (!j || agoraTs - j.inicio > janelaMs) {
      janelas.set(k, { n: 1, inicio: agoraTs });
      return next();
    }
    j.n += 1;
    if (j.n > max) {
      return res.status(429).json({ error: 'muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }
    next();
  };
}

// limpa de vez em quando para não crescer sem limite
setInterval(() => {
  const agoraTs = Date.now();
  for (const [k, j] of janelas) if (agoraTs - j.inicio > 30 * 60 * 1000) janelas.delete(k);
}, 10 * 60 * 1000).unref?.();
