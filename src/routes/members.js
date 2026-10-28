// Área de membros: login (conta criada após o pagamento), receitas liberadas,
// busca/filtros, favoritos, lista de compras gerada, histórico, perfil e
// redefinição de senha. O cadastro público NÃO existe: a conta nasce no checkout.
import { Router } from 'express';
import { read, write, agora } from '../lib/db.js';
import {
  requireMember, criarSessao, destruirSessao,
  hashSenha, conferirSenha,
} from '../lib/auth.js';
import { sendEmail, emailDefinirSenha } from '../lib/mail.js';
import { baseUrl } from '../lib/helpers.js';
import {
  receitasLiberadas, proximaReceita, liberarPendentesSeNecessario,
} from '../lib/release.js';
import { track } from '../lib/analytics.js';
import { consumirToken, tokenDefinirSenha } from './checkout.js';

const router = Router();
const diasAte = (data) => Math.max(0, Math.ceil((new Date(data) - Date.now()) / 864e5));

// ---------- Conta ----------
router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  const users = await read('users', []);
  const u = users.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || !conferirSenha(senha, u.senhaSalt, u.senhaHash)) {
    return res.status(401).json({ error: 'e-mail ou senha incorretos' });
  }
  await criarSessao(res, u.id, 'membro');
  u.ultimaVisita = agora();
  await write('users', users);
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
});

router.post('/sair', async (req, res) => {
  await destruirSessao(req, res);
  res.json({ ok: true });
});

// Perfil: editar nome e trocar senha (exige a senha atual)
router.put('/perfil', requireMember, async (req, res) => {
  const { nome, senhaAtual, senhaNova } = req.body || {};
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);

  if (senhaNova) {
    if (!senhaAtual || !conferirSenha(senhaAtual, u.senhaSalt, u.senhaHash)) {
      return res.status(401).json({ error: 'senha atual incorreta' });
    }
    if (senhaNova.length < 6) return res.status(400).json({ error: 'a nova senha precisa de pelo menos 6 caracteres' });
    const { salt, hash } = hashSenha(senhaNova);
    u.senhaSalt = salt;
    u.senhaHash = hash;
    u.senhaDefinida = true;
  }
  if (nome && nome.trim()) u.nome = nome.trim();
  await write('users', users);
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
});

// Define a senha a partir do link enviado por e-mail (pós-compra ou redefinição).
router.post('/definir-senha', async (req, res) => {
  const { token, senha } = req.body || {};
  const userId = await consumirToken(token);
  if (!userId) return res.status(400).json({ error: 'link inválido ou expirado' });
  if (!senha || senha.length < 6) return res.status(400).json({ error: 'senha muito curta (mín. 6)' });
  const users = await read('users', []);
  const u = users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: 'conta não encontrada' });
  const { salt, hash } = hashSenha(senha);
  u.senhaSalt = salt;
  u.senhaHash = hash;
  u.senhaDefinida = true;
  await write('users', users);
  await criarSessao(res, u.id, 'membro');
  res.json({ ok: true });
});

// Esqueci minha senha: envia link de redefinição (resposta genérica de propósito).
router.post('/recuperar-senha', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase();
  const u = (await read('users', [])).find((x) => x.email.toLowerCase() === email);
  if (u) {
    const link = `${baseUrl()}/login.html?definir=${u.id}.${tokenDefinirSenha(u.id)}`;
    try {
      await sendEmail({ to: u.email, subject: 'Redefina sua senha — Oferta Fit BR', html: emailDefinirSenha(u.nome, link) });
    } catch (e) {
      console.error('[EMAIL] recuperação de senha:', e.message);
    }
  }
  res.json({ ok: true, mensagem: 'Se este e-mail tiver uma conta, enviamos o link de redefinição.' });
});

router.get('/eu', requireMember, async (req, res) => {
  await liberarPendentesSeNecessario().catch(() => {});
  const u = req.usuario;
  const [liberadas, proxima] = await Promise.all([receitasLiberadas(), proximaReceita()]);
  res.json({
    usuario: {
      id: u.id, nome: u.nome, email: u.email,
      acesso: u.acesso, criadoEm: u.criadoEm,
      favoritos: u.favoritos || [],
      feitas: u.feitas || [],
    },
    receitas_liberadas: liberadas.length,
    proxima: proxima ? { nome: proxima.nome, data: proxima.data_liberacao, dias: diasAte(proxima.data_liberacao) } : null,
  });
});

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

router.get('/receitas', requireMember, async (req, res) => {
  await liberarPendentesSeNecessario().catch(() => {});
  const { q, categoria, tags, tempo } = req.query;
  const u = req.usuario;
  let lista = (await receitasLiberadas()).map((r) => receitaPublica(r, u));

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
  const proxima = await proximaReceita();
  res.json({
    receitas: lista,
    proxima: proxima ? { nome: proxima.nome, data: proxima.data_liberacao, dias: diasAte(proxima.data_liberacao) } : null,
  });
});

router.get('/receitas/:id', requireMember, async (req, res) => {
  const r = (await receitasLiberadas()).find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada ou ainda não liberada' });
  res.json({ receita: { ...receitaPublica(r, req.usuario), ingredientes: r.ingredientes || [], passos: r.passos || [], dicas: r.dicas || '' } });
});

// ---------- Favoritos ----------
router.post('/favoritos/:id', requireMember, async (req, res) => {
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.favoritos = u.favoritos || [];
  const i = u.favoritos.indexOf(req.params.id);
  if (i >= 0) u.favoritos.splice(i, 1); else u.favoritos.push(req.params.id);
  await write('users', users);
  res.json({ ok: true, favoritos: u.favoritos });
});

router.get('/favoritos', requireMember, async (req, res) => {
  const u = req.usuario;
  const lista = (await receitasLiberadas())
    .filter((r) => (u.favoritos || []).includes(r.id))
    .map((r) => receitaPublica(r, u));
  res.json({ receitas: lista });
});

// ---------- Histórico (receitas já feitas) ----------
router.post('/feitas/:id', requireMember, async (req, res) => {
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.feitas = u.feitas || [];
  const i = u.feitas.findIndex((f) => f.receitaId === req.params.id);
  if (i >= 0) u.feitas.splice(i, 1);
  else u.feitas.push({ receitaId: req.params.id, data: agora() });
  await write('users', users);
  res.json({ ok: true, feitas: u.feitas });
});

router.get('/historico', requireMember, async (req, res) => {
  const u = req.usuario;
  const porId = Object.fromEntries((await receitasLiberadas()).map((r) => [r.id, r]));
  const lista = (u.feitas || [])
    .map((f) => ({ data: f.data, receita: porId[f.receitaId] ? receitaPublica(porId[f.receitaId], u) : null }))
    .filter((x) => x.receita)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json({ historico: lista });
});

// ---------- Lista de compras ----------
// Gera a lista a partir de receitas selecionadas, agrupando ingredientes iguais.
router.post('/lista/gerar', requireMember, async (req, res) => {
  const { receitaIds } = req.body || {};
  if (!Array.isArray(receitaIds) || !receitaIds.length) return res.status(400).json({ error: 'selecione ao menos uma receita' });
  const receitas = (await receitasLiberadas()).filter((r) => receitaIds.includes(r.id));
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
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.lista = itens;
  await write('users', users);
  await track({ tipo: 'lista_gerada', receitaId: receitaIds[0], origem: 'membros' });
  res.json({ ok: true, itens });
});

router.get('/lista', requireMember, (req, res) => {
  res.json({ itens: req.usuario.lista || [] });
});

router.post('/lista/item', requireMember, async (req, res) => {
  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'informe o item' });
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.lista = u.lista || [];
  u.lista.push({ qtd: '', unidade: '', item: texto, receitas: ['adicionado à mão'], marcado: false });
  await write('users', users);
  res.json({ ok: true, itens: u.lista });
});

// Adiciona ingredientes de uma receita (com quantidades já ajustadas pelas
// porções escolhidas) à lista, somando com o que já existe.
router.post('/lista/adicionar', requireMember, async (req, res) => {
  const { itens, receita } = req.body || {};
  if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ error: 'nenhum ingrediente enviado' });

  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.lista = u.lista || [];

  itens.forEach((ing) => {
    const item = String(ing.item || '').trim();
    if (!item) return;
    const unidade = String(ing.unidade || '').trim();
    const chave = `${item.toLowerCase()}|${unidade.toLowerCase()}`;
    const qtdNum = parseFloat(String(ing.qtd ?? '').replace(',', '.'));

    const existente = u.lista.find(
      (l) => `${String(l.item).toLowerCase()}|${String(l.unidade || '').toLowerCase()}` === chave
    );
    if (existente) {
      const atual = parseFloat(String(existente.qtd).replace(',', '.'));
      if (!Number.isNaN(qtdNum) && !Number.isNaN(atual)) {
        existente.qtd = String(Math.round((atual + qtdNum) * 100) / 100);
      }
      if (receita && !(existente.receitas || []).includes(receita)) existente.receitas.push(receita);
    } else {
      u.lista.push({
        qtd: ing.qtd ?? '', unidade, item,
        receitas: receita ? [receita] : ['adicionado à mão'],
        marcado: false,
      });
    }
  });

  await write('users', users);
  res.json({ ok: true, itens: u.lista });
});

router.post('/lista/marcar', requireMember, async (req, res) => {
  const { index, marcado } = req.body || {};
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  if (!u.lista || !u.lista[index]) return res.status(404).json({ error: 'item não encontrado' });
  u.lista[index].marcado = !!marcado;
  await write('users', users);
  res.json({ ok: true, itens: u.lista });
});

router.delete('/lista/item/:index', requireMember, async (req, res) => {
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  if (u.lista) u.lista.splice(Number(req.params.index), 1);
  await write('users', users);
  res.json({ ok: true, itens: u.lista || [] });
});

router.delete('/lista', requireMember, async (req, res) => {
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.usuario.id);
  u.lista = [];
  await write('users', users);
  res.json({ ok: true });
});

export default router;
