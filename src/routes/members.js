// Área de membros: login/cadastro, receitas liberadas, busca/filtros, favoritos,
// lista de compras gerada, histórico de receitas feitas e próxima liberação.
import { Router } from 'express';
import { read, write, update, id, agora } from '../lib/db.js';
import {
  requireMember, usuarioDaSessao, criarSessao, destruirSessao,
  hashSenha, conferirSenha, garantirConta,
} from '../lib/auth.js';
import { sendEmail, emailBoasVindas, urlMembros } from '../lib/mail.js';
import { receitasLiberadas, proximaReceita } from '../lib/release.js';
import { track } from '../lib/analytics.js';
import { consumirToken } from './checkout.js';

const router = Router();

// ---------- Conta ----------
router.post('/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !email?.includes('@') || !senha || senha.length < 6) {
    return res.status(400).json({ error: 'preencha nome, e-mail e senha (mín. 6 caracteres)' });
  }
  const users = read('users', []);
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'já existe uma conta com este e-mail — faça login' });
  }
  const u = garantirConta({ nome, email, senha });
  u.senhaDefinida = true;
  write('users', users);
  criarSessao(res, u.id, 'membro');
  track({ tipo: 'signup', sessao: req.body?.sessao, origem: 'membros' });
  try { await sendEmail({ to: u.email, subject: 'Bem-vindo(a) ao Oferta Fit BR!', html: emailBoasVindas(u.nome, urlMembros()) }); } catch {}
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body || {};
  const u = read('users', []).find((x) => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || !conferirSenha(senha, u.senhaSalt, u.senhaHash)) {
    return res.status(401).json({ error: 'e-mail ou senha incorretos' });
  }
  criarSessao(res, u.id, 'membro');
  u.ultimaVisita = agora();
  write('users', read('users', []));
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
});

// Define a senha a partir do link enviado por e-mail após a compra.
router.post('/definir-senha', (req, res) => {
  const { token, senha } = req.body || {};
  const userId = consumirToken(token);
  if (!userId) return res.status(400).json({ error: 'link inválido ou expirado' });
  if (!senha || senha.length < 6) return res.status(400).json({ error: 'senha muito curta (mín. 6)' });
  const users = read('users', []);
  const u = users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: 'conta não encontrada' });
  const { salt, hash } = hashSenha(senha);
  u.senhaSalt = salt;
  u.senhaHash = hash;
  u.senhaDefinida = true;
  write('users', users);
  criarSessao(res, u.id, 'membro');
  res.json({ ok: true });
});

router.post('/sair', (req, res) => {
  destruirSessao(req, res);
  res.json({ ok: true });
});

router.get('/eu', requireMember, (req, res) => {
  const u = req.usuario;
  const liberadas = receitasLiberadas();
  res.json({
    usuario: {
      id: u.id, nome: u.nome, email: u.email,
      acesso: u.acesso, criadoEm: u.criadoEm,
      favoritos: u.favoritos || [],
      feitas: u.feitas || [],
    },
    receitas_liberadas: liberadas.length,
    proxima: proximaReceita()
      ? { nome: proximaReceita().nome, data: proximaReceita().data_liberacao, dias: diasAte(proximaReceita().data_liberacao) }
      : null,
  });
});

const diasAte = (data) => Math.max(0, Math.ceil((new Date(data) - Date.now()) / 864e5));

// ---------- Receitas ----------
const receitaPublica = (r, u) => ({
  id: r.id,
  nome: r.nome,
  descricao: r.descricao,
  categoria: r.categoria,
  tags: r.tags || [],
  tempo_preparo_min: r.tempo_preparo_min,
  porcoes: r.porcoes,
  foto: r.foto || null,
  data_liberacao: r.data_liberacao,
  nutricao: r.nutricao || null,
  favorito: (u?.favoritos || []).includes(r.id),
  feita: (u?.feitas || []).some((f) => f.receitaId === r.id),
});

router.get('/receitas', requireMember, (req, res) => {
  const { q, categoria, tags, tempo } = req.query;
  const u = req.usuario;
  let lista = receitasLiberadas().map((r) => receitaPublica(r, u));

  if (categoria) lista = lista.filter((r) => r.categoria === categoria);
  if (tags) {
    const alvo = String(tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    lista = lista.filter((r) => alvo.every((t) => (r.tags || []).map((x) => x.toLowerCase()).includes(t)));
  }
  if (tempo) lista = lista.filter((r) => r.tempo_preparo_min <= Number(tempo));
  if (q) {
    const termo = String(q).toLowerCase();
    lista = lista.filter((r) =>
      r.nome.toLowerCase().includes(termo) ||
      (r.descricao || '').toLowerCase().includes(termo) ||
      (r.tags || []).some((t) => t.toLowerCase().includes(termo))
    );
  }
  res.json({ receitas: lista, proxima: proximaReceita() ? { nome: proximaReceita().nome, data: proximaReceita().data_liberacao, dias: diasAte(proximaReceita().data_liberacao) } : null });
});

router.get('/receitas/:id', requireMember, (req, res) => {
  const r = receitasLiberadas().find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada ou ainda não liberada' });
  res.json({ receita: { ...receitaPublica(r, req.usuario), ingredientes: r.ingredientes || [], passos: r.passos || [], dicas: r.dicas || '' } });
});

// ---------- Favoritos ----------
router.post('/favoritos/:id', requireMember, (req, res) => {
  const u = req.usuario;
  u.favoritos = u.favoritos || [];
  const i = u.favoritos.indexOf(req.params.id);
  if (i >= 0) u.favoritos.splice(i, 1); else u.favoritos.push(req.params.id);
  write('users', read('users', []));
  res.json({ ok: true, favoritos: u.favoritos });
});

router.get('/favoritos', requireMember, (req, res) => {
  const u = req.usuario;
  const lista = receitasLiberadas()
    .filter((r) => (u.favoritos || []).includes(r.id))
    .map((r) => receitaPublica(r, u));
  res.json({ receitas: lista });
});

// ---------- Histórico (receitas já feitas) ----------
router.post('/feitas/:id', requireMember, (req, res) => {
  const u = req.usuario;
  u.feitas = u.feitas || [];
  const i = u.feitas.findIndex((f) => f.receitaId === req.params.id);
  if (i >= 0) u.feitas.splice(i, 1);
  else u.feitas.push({ receitaId: req.params.id, data: agora() });
  write('users', read('users', []));
  res.json({ ok: true, feitas: u.feitas });
});

router.get('/historico', requireMember, (req, res) => {
  const u = req.usuario;
  const porId = Object.fromEntries(receitasLiberadas().map((r) => [r.id, r]));
  const lista = (u.feitas || [])
    .map((f) => ({ data: f.data, receita: porId[f.receitaId] ? receitaPublica(porId[f.receitaId], u) : null }))
    .filter((x) => x.receita)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json({ historico: lista });
});

// ---------- Lista de compras ----------
// Gera a lista a partir de receitas selecionadas, agrupando ingredientes iguais.
router.post('/lista/gerar', requireMember, (req, res) => {
  const { receitaIds } = req.body || {};
  if (!Array.isArray(receitaIds) || !receitaIds.length) return res.status(400).json({ error: 'selecione ao menos uma receita' });
  const receitas = receitasLiberadas().filter((r) => receitaIds.includes(r.id));
  const mapa = new Map();

  receitas.forEach((r) => {
    (r.ingredientes || []).forEach((ing) => {
      const chave = `${String(ing.item || ing).toLowerCase().trim()}|${ing.unidade || ''}`;
      const existente = mapa.get(chave);
      const qtd = parseFloat(String(ing.qtd ?? '').replace(',', '.'));
      if (existente && !Number.isNaN(qtd) && existente.qtdNum) {
        existente.qtdNum += qtd;
        existente.qtd = String(Math.round(existente.qtdNum * 100) / 100);
      } else {
        mapa.set(chave, {
          qtd: ing.qtd ?? '', unidade: ing.unidade || '', item: ing.item || String(ing),
          qtdNum: qtd, receitas: [r.nome], marcado: false,
        });
        if (Number.isNaN(qtd)) mapa.get(chave).qtdNum = null;
      }
      if (mapa.get(chave) && !mapa.get(chave).receitas.includes(r.nome)) mapa.get(chave).receitas.push(r.nome);
    });
  });

  const itens = [...mapa.values()].map(({ qtdNum, ...resto }) => resto);
  const u = req.usuario;
  u.lista = itens;
  write('users', read('users', []));
  track({ tipo: 'lista_gerada', receitaId: receitaIds[0], origem: 'membros' });
  res.json({ ok: true, itens });
});

router.get('/lista', requireMember, (req, res) => {
  res.json({ itens: req.usuario.lista || [] });
});

router.post('/lista/item', requireMember, (req, res) => {
  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'informe o item' });
  const u = req.usuario;
  u.lista = u.lista || [];
  u.lista.push({ qtd: '', unidade: '', item: texto, receitas: ['adicionado à mão'], marcado: false });
  write('users', read('users', []));
  res.json({ ok: true, itens: u.lista });
});

router.post('/lista/marcar', requireMember, (req, res) => {
  const { index, marcado } = req.body || {};
  const u = req.usuario;
  if (!u.lista || !u.lista[index]) return res.status(404).json({ error: 'item não encontrado' });
  u.lista[index].marcado = !!marcado;
  write('users', read('users', []));
  res.json({ ok: true, itens: u.lista });
});

router.delete('/lista/item/:index', requireMember, (req, res) => {
  const u = req.usuario;
  if (u.lista) u.lista.splice(Number(req.params.index), 1);
  write('users', read('users', []));
  res.json({ ok: true, itens: u.lista || [] });
});

router.delete('/lista', requireMember, (req, res) => {
  req.usuario.lista = [];
  write('users', read('users', []));
  res.json({ ok: true });
});

export default router;
