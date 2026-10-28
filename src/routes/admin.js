// Painel administrativo: receitas (CRUD + foto + agendamento), alunos/acessos,
// pedidos, métricas (analytics) e configurações.
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { read, write, id, agora, DATA_DIR } from '../lib/db.js';
import { requireAdmin, criarSessao, destruirSessao, isSessaoAdmin, hashSenha, conferirSenha } from '../lib/auth.js';
import { resumo } from '../lib/analytics.js';
import { liberarPendentes, receitasLiberadas, proximaReceita } from '../lib/release.js';
import { sendEmail, emailNovaReceita, urlMembros } from '../lib/mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'assets', 'receitas');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now().toString(36)}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const router = Router();

// ---------- Login admin ----------
router.post('/login', (req, res) => {
  const { senha } = req.body || {};
  const esperada = process.env.ADMIN_SENHA || read('settings', {}).adminSenha || 'admin123';
  if (String(senha) !== String(esperada)) return res.status(401).json({ error: 'senha incorreta' });
  criarSessao(res, 'admin', 'admin');
  res.json({ ok: true });
});

router.post('/sair', (req, res) => {
  destruirSessao(req, res);
  res.json({ ok: true });
});

router.get('/sessao', (req, res) => res.json({ admin: isSessaoAdmin(req) }));

router.use(requireAdmin);

// ---------- Receitas ----------
router.get('/receitas', (req, res) => {
  const lista = read('receitas', []).slice().sort((a, b) => new Date(b.data_liberacao) - new Date(a.data_liberacao));
  res.json({ receitas: lista, agora: new Date().toISOString() });
});

const validarReceita = (b) => {
  if (!b.nome || !b.data_liberacao) return 'nome e data de liberação são obrigatórios';
  if (Number.isNaN(new Date(b.data_liberacao).getTime())) return 'data de liberação inválida';
  return null;
};

router.post('/receitas', (req, res) => {
  const b = req.body || {};
  const erro = validarReceita(b);
  if (erro) return res.status(400).json({ error: erro });

  const receita = {
    id: id('rec'),
    nome: b.nome,
    descricao: b.descricao || '',
    categoria: b.categoria || 'almoco',
    tags: b.tags || [],
    tempo_preparo_min: Number(b.tempo_preparo_min) || 20,
    porcoes: Number(b.porcoes) || 2,
    ingredientes: b.ingredientes || [],
    passos: b.passos || [],
    nutricao: b.nutricao || null,
    dicas: b.dicas || '',
    foto: b.foto || null,
    data_liberacao: new Date(b.data_liberacao).toISOString(),
    liberada: new Date(b.data_liberacao) <= new Date(),
    liberadaEm: null,
    ativo: b.ativo !== false,
    criadoEm: agora(),
  };
  const receitas = read('receitas', []);
  receitas.push(receita);
  write('receitas', receitas);
  liberarPendentes().catch(() => {});
  res.json({ ok: true, receita });
});

router.put('/receitas/:id', (req, res) => {
  const b = req.body || {};
  const erro = validarReceita(b);
  if (erro) return res.status(400).json({ error: erro });
  const receitas = read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });

  Object.assign(r, {
    nome: b.nome, descricao: b.descricao ?? r.descricao, categoria: b.categoria ?? r.categoria,
    tags: b.tags ?? r.tags, tempo_preparo_min: Number(b.tempo_preparo_min) ?? r.tempo_preparo_min,
    porcoes: Number(b.porcoes) ?? r.porcoes, ingredientes: b.ingredientes ?? r.ingredientes,
    passos: b.passos ?? r.passos, nutricao: b.nutricao ?? r.nutricao, dicas: b.dicas ?? r.dicas,
    foto: b.foto ?? r.foto, data_liberacao: new Date(b.data_liberacao).toISOString(),
    ativo: b.ativo !== false,
  });
  // se a data já passou, mantém a regra de visibilidade
  if (new Date(r.data_liberacao) <= new Date()) r.liberada = true;
  write('receitas', receitas);
  liberarPendentes().catch(() => {});
  res.json({ ok: true, receita: r });
});

router.delete('/receitas/:id', (req, res) => {
  write('receitas', read('receitas', []).filter((r) => r.id !== req.params.id));
  res.json({ ok: true });
});

// Upload da foto do prato
router.post('/receitas/:id/foto', upload.single('foto'), (req, res) => {
  const receitas = read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });
  if (!req.file) return res.status(400).json({ error: 'envie uma imagem (jpg, png ou webp até 6MB)' });
  r.foto = `/assets/receitas/${req.file.filename}`;
  write('receitas', receitas);
  res.json({ ok: true, foto: r.foto });
});

// Publicar agora (força a liberação imediata e o e-mail semanal)
router.post('/receitas/:id/publicar', async (req, res) => {
  const receitas = read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });
  r.data_liberacao = new Date().toISOString();
  r.liberada = true;
  r.liberadaEm = agora();
  write('receitas', receitas);

  const membros = read('users', []).filter((u) => u.acesso?.ativo);
  for (const u of membros) {
    try {
      await sendEmail({ to: u.email, subject: `Nova receita liberada: ${r.nome} 🥗`, html: emailNovaReceita(u.nome, r, `${urlMembros()}?receita=${r.id}`) });
    } catch {}
  }
  res.json({ ok: true, receita: r, emails: membros.length });
});

// ---------- Alunos / acessos ----------
router.get('/alunos', (req, res) => {
  const usuarios = read('users', []);
  const pedidos = read('orders', []);
  const lista = usuarios.map((u) => ({
    id: u.id, nome: u.nome, email: u.email, criadoEm: u.criadoEm,
    acesso: u.acesso, ultimaVisita: u.ultimaVisita,
    favoritos: (u.favoritos || []).length, feitas: (u.feitas || []).length,
    ultimoPedido: pedidos.filter((p) => p.email === u.email).slice(-1)[0] || null,
  }));
  res.json({ alunos: lista });
});

router.post('/alunos/:id/acesso', (req, res) => {
  const users = read('users', []);
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'aluno não encontrado' });
  u.acesso = u.acesso || {};
  u.acesso.ativo = req.body?.ativo !== false;
  if (u.acesso.ativo) u.acesso.liberadoEm = u.acesso.liberadoEm || agora();
  write('users', users);
  res.json({ ok: true, acesso: u.acesso });
});

router.delete('/alunos/:id', (req, res) => {
  write('users', read('users', []).filter((u) => u.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- Pedidos ----------
router.get('/pedidos', (req, res) => {
  const lista = read('orders', []).slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  res.json({ pedidos: lista });
});

// ---------- Métricas ----------
router.get('/metricas', (req, res) => {
  const { de, ate, dias } = req.query;
  const r = resumo({ de, ate, dias: Number(dias) || 14 });
  r.receitas = {
    total: read('receitas', []).length,
    liberadas: receitasLiberadas().length,
    proxima: proximaReceita() ? { nome: proximaReceita().nome, data: proximaReceita().data_liberacao } : null,
  };
  r.alunos = {
    total: read('users', []).length,
    ativos: read('users', []).filter((u) => u.acesso?.ativo).length,
  };
  res.json(r);
});

// ---------- Configurações ----------
router.get('/config', (req, res) => {
  const s = { ...read('settings', {}) };
  delete s.adminSenha;
  res.json({ config: s });
});

router.put('/config', (req, res) => {
  const s = read('settings', {});
  const b = req.body || {};
  ['nomeProduto', 'preco', 'precoAntigo', 'garantiaDias', 'emailSuporte', 'diaLiberacao', 'fraseRodape'].forEach((k) => {
    if (b[k] !== undefined) s[k] = b[k];
  });
  if (b.adminSenha) {
    const { salt, hash } = hashSenha(b.adminSenha);
    s.adminSenhaHash = hash; s.adminSenhaSalt = salt; s.adminSenha = b.adminSenha;
  }
  write('settings', s);
  res.json({ ok: true, config: { ...s, adminSenha: undefined } });
});

router.post('/email/teste', async (req, res) => {
  const { email } = req.body || {};
  if (!email?.includes('@')) return res.status(400).json({ error: 'informe um e-mail válido' });
  const r = await sendEmail({ to: email, subject: 'Teste — Oferta Fit BR ✅', html: '<p>Seu e-mail está configurado corretamente!</p>' });
  res.json({ ok: true, ...r });
});

export default router;
