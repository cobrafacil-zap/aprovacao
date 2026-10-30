// Rotas públicas: dados do produto para a LP, prévia de receitas e tracking de analytics.
import { Router } from 'express';
import { read } from '../lib/db.js';
import { track } from '../lib/analytics.js';
import { receitasLiberadas, proximaReceita, liberarPendentesSeNecessario } from '../lib/release.js';
import { calcularNutricao } from '../lib/nutricao.js';
import { detectarTags } from '../lib/tags.js';
import { limite } from '../lib/limite.js';

const router = Router();

const RECEITA_PUBLICA = (r) => ({
  id: r.id,
  nome: r.nome,
  descricao: r.descricao,
  categoria: r.categoria,
  tags: detectarTags(r), // sempre automáticas
  tempo_preparo_min: r.tempo_preparo_min,
  porcoes: r.porcoes,
  foto: r.foto || null,
  data_liberacao: r.data_liberacao,
  nutricao_aprox: calcularNutricao(r.ingredientes || [], r.porcoes || 1),
});

router.get('/produto', async (req, res) => {
  const s = await read('settings', {});
  res.json({
    nome: s.nomeProduto || 'OfertaFitBR',
    preco: s.preco ?? 19.9,
    precoAntigo: s.precoAntigo ?? 97,
    moeda: 'BRL',
    garantia_dias: s.garantiaDias ?? 7,
    formas_pagamento: ['Pix', 'Cartão de crédito', 'Boleto'],
    atualizacao: 'uma nova receita por semana',
    acesso: 'vitalício',
    mp_public_key: process.env.MP_PUBLIC_KEY || null,
    mp_ativo: !!process.env.MP_ACCESS_TOKEN,
  });
});

// Prévia para a LP (prints do produto): receitas liberadas + próxima.
router.get('/receitas/preview', async (req, res) => {
  await liberarPendentesSeNecessario().catch(() => {});
  const liberadas = await receitasLiberadas();
  const proxima = await proximaReceita();
  res.json({
    total: liberadas.length,
    itens: liberadas.slice(0, 3).map(RECEITA_PUBLICA),
    proxima: proxima ? { nome: proxima.nome, data: proxima.data_liberacao } : null,
  });
});

// Tracking público (LP e checkout). Nunca bloqueia a página.
router.post('/track', limite({ max: 60, janelaMs: 60 * 1000 }), async (req, res) => {
  try {
    const b = req.body || {};
    await track({
      tipo: b.tipo,
      pagina: b.pagina,
      sessao: b.sessao,
      utm: b.utm,
      referrer: b.referrer,
      valor: b.valor,
      pedidoId: b.pedidoId,
      dispositivo: /mobile|android|iphone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop',
    });
  } catch (e) {
    console.error('[TRACK]', e.message);
  }
  res.json({ ok: true });
});

export default router;
