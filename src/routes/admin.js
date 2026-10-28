// Painel administrativo: login, receitas (CRUD + foto + agendamento), membros,
// pedidos, métricas e configurações.
// Upload de foto: Vercel Blob em produção (BLOB_READ_WRITE_TOKEN);
// sem token, grava em public/assets/receitas/ (desenvolvimento local).
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { read, write, id, agora } from '../lib/db.js';
import { requireAdmin, criarSessao, destruirSessao, isSessaoAdmin, hashSenha } from '../lib/auth.js';
import { resumo, track } from '../lib/analytics.js';
import { liberarPendentes, receitasLiberadas, proximaReceita } from '../lib/release.js';
import { sendEmail, emailNovaReceita, emailTeste, urlMembros } from '../lib/mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'assets', 'receitas');

// memória: o arquivo vai direto para o Blob (produção) ou para o disco (dev)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // a Vercel recusa payloads > ~4,5 MB
  fileFilter: (req, file, cb) =>
    cb(null, /^image\//.test(file.mimetype) || /\.(jpe?g|png|webp)$/i.test(file.originalname || '')),
});

const router = Router();

// ---------- Login admin ----------
router.post('/login', async (req, res) => {
  const { senha } = req.body || {};
  const settings = await read('settings', {});
  const esperada = process.env.ADMIN_SENHA || settings.adminSenha || 'Comsoc1#';
  if (String(senha) !== String(esperada)) return res.status(401).json({ error: 'senha incorreta' });
  await criarSessao(res, 'admin', 'admin');
  res.json({ ok: true });
});

router.post('/sair', async (req, res) => {
  await destruirSessao(req, res);
  res.json({ ok: true });
});

router.get('/sessao', async (req, res) => {
  res.json({ admin: await isSessaoAdmin(req) });
});

router.use(requireAdmin);

// ---------- Receitas ----------
router.get('/receitas', async (req, res) => {
  const lista = (await read('receitas', [])).slice().sort((a, b) => new Date(b.data_liberacao) - new Date(a.data_liberacao));
  res.json({ receitas: lista, agora: new Date().toISOString() });
});

const validarReceita = (b) => {
  if (!b.nome || !b.data_liberacao) return 'nome e data de liberação são obrigatórios';
  if (Number.isNaN(new Date(b.data_liberacao).getTime())) return 'data de liberação inválida';
  return null;
};

router.post('/receitas', async (req, res) => {
  const b = req.body || {};
  const erro = validarReceita(b);
  if (erro) return res.status(400).json({ error: erro });

  const receita = {
    id: id('rec'),
    nome: b.nome,
    descricao: b.descricao || '',
    categoria: b.categoria || 'almoco',
    tags: b.tags || [],
    dificuldade: b.dificuldade || 'facil',
    custo: b.custo || 'baixo',
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
  const receitas = await read('receitas', []);
  receitas.push(receita);
  await write('receitas', receitas);
  liberarPendentes().catch(() => {});
  res.json({ ok: true, receita });
});

router.put('/receitas/:id', async (req, res) => {
  const b = req.body || {};
  const erro = validarReceita(b);
  if (erro) return res.status(400).json({ error: erro });
  const receitas = await read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });

  Object.assign(r, {
    nome: b.nome, descricao: b.descricao ?? r.descricao, categoria: b.categoria ?? r.categoria,
    tags: b.tags ?? r.tags,
    dificuldade: b.dificuldade ?? r.dificuldade,
    custo: b.custo ?? r.custo,
    // cuidado: Number(undefined) = NaN — só troca se veio valor válido
    tempo_preparo_min: Number(b.tempo_preparo_min) || r.tempo_preparo_min || 20,
    porcoes: Number(b.porcoes) || r.porcoes || 2,
    ingredientes: b.ingredientes ?? r.ingredientes,
    passos: b.passos ?? r.passos, nutricao: b.nutricao ?? r.nutricao, dicas: b.dicas ?? r.dicas,
    foto: b.foto ?? r.foto, data_liberacao: new Date(b.data_liberacao).toISOString(),
    ativo: b.ativo !== false,
  });
  if (new Date(r.data_liberacao) <= new Date()) r.liberada = true;
  await write('receitas', receitas);
  liberarPendentes().catch(() => {});
  res.json({ ok: true, receita: r });
});

router.delete('/receitas/:id', async (req, res) => {
  await write('receitas', (await read('receitas', [])).filter((r) => r.id !== req.params.id));
  res.json({ ok: true });
});

// Upload da foto do prato (Blob em produção / disco em dev)
router.post('/receitas/:id/foto', upload.single('foto'), async (req, res) => {
  const receitas = await read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });
  if (!req.file) return res.status(400).json({ error: 'envie uma imagem (jpg, png ou webp até 6MB)' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const nomeArquivo = `${Date.now().toString(36)}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`receitas/${nomeArquivo}`, req.file.buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    r.foto = blob.url;
  } else {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, nomeArquivo), req.file.buffer);
    r.foto = `/assets/receitas/${nomeArquivo}`;
  }

  await write('receitas', receitas);
  res.json({ ok: true, foto: r.foto });
});

// Publicar agora (força a liberação imediata + e-mail)
router.post('/receitas/:id/publicar', async (req, res) => {
  const receitas = await read('receitas', []);
  const r = receitas.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'receita não encontrada' });
  r.data_liberacao = new Date().toISOString();
  r.liberada = true;
  r.liberadaEm = agora();
  await write('receitas', receitas);

  const membros = (await read('users', [])).filter((u) => u.acesso?.ativo);
  for (const u of membros) {
    try {
      await sendEmail({ to: u.email, subject: `Nova receita liberada: ${r.nome} 🥗`, html: emailNovaReceita(u.nome, r, `${urlMembros()}?receita=${r.id}`) });
    } catch {}
  }
  await track({ tipo: 'receita_liberada', receitaId: r.id, origem: 'admin' });
  res.json({ ok: true, receita: r, emails: membros.length });
});

// ---------- Membros / acessos ----------
router.get('/membros', async (req, res) => {
  const [usuarios, pedidos] = await Promise.all([read('users', []), read('orders', [])]);
  const lista = usuarios.map((u) => ({
    id: u.id, nome: u.nome, email: u.email, criadoEm: u.criadoEm,
    acesso: u.acesso, ultimaVisita: u.ultimaVisita,
    favoritos: (u.favoritos || []).length, feitas: (u.feitas || []).length,
    ultimoPedido: pedidos.filter((p) => p.email === u.email).slice(-1)[0] || null,
  }));
  res.json({ membros: lista });
});

router.post('/membros/:id/acesso', async (req, res) => {
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'membro não encontrado' });
  u.acesso = u.acesso || {};
  u.acesso.ativo = req.body?.ativo !== false;
  if (u.acesso.ativo) {
    u.acesso.pendente = false;
    u.acesso.liberadoEm = u.acesso.liberadoEm || agora();
  }
  await write('users', users);
  res.json({ ok: true, acesso: u.acesso });
});

// Define/resetar a senha de um membro (para quem perdeu o acesso)
router.post('/membros/:id/senha', async (req, res) => {
  const { senha } = req.body || {};
  if (!senha || senha.length < 6) return res.status(400).json({ error: 'a senha precisa de pelo menos 6 caracteres' });
  const users = await read('users', []);
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'membro não encontrado' });
  const { salt, hash } = hashSenha(senha);
  u.senhaSalt = salt;
  u.senhaHash = hash;
  u.senhaDefinida = true;
  await write('users', users);
  res.json({ ok: true, email: u.email });
});

router.delete('/membros/:id', async (req, res) => {
  await write('users', (await read('users', [])).filter((u) => u.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- Pedidos ----------
router.get('/pedidos', async (req, res) => {
  const lista = (await read('orders', [])).slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  res.json({ pedidos: lista });
});

// ---------- Métricas ----------
router.get('/metricas', async (req, res) => {
  const { de, ate, dias } = req.query;
  const [m, receitas, usuarios, proxima] = await Promise.all([
    resumo({ de, ate, dias: Number(dias) || 14 }),
    read('receitas', []),
    read('users', []),
    proximaReceita(),
  ]);
  m.receitas = {
    total: receitas.length,
    liberadas: (await receitasLiberadas()).length,
    proxima: proxima ? { nome: proxima.nome, data: proxima.data_liberacao } : null,
  };
  m.membros = {
    total: usuarios.length,
    ativos: usuarios.filter((u) => u.acesso?.ativo).length,
  };
  res.json(m);
});

// ---------- Configurações ----------
router.get('/config', async (req, res) => {
  const s = { ...(await read('settings', {})) };
  delete s.adminSenha;
  res.json({ config: s });
});

router.put('/config', async (req, res) => {
  const s = await read('settings', {});
  const b = req.body || {};
  ['nomeProduto', 'preco', 'precoAntigo', 'garantiaDias', 'emailSuporte', 'diaLiberacao', 'fraseRodape'].forEach((k) => {
    if (b[k] !== undefined) s[k] = b[k];
  });
  if (b.adminSenha) {
    const { salt, hash } = hashSenha(b.adminSenha);
    s.adminSenhaHash = hash; s.adminSenhaSalt = salt; s.adminSenha = b.adminSenha;
  }
  await write('settings', s);
  res.json({ ok: true, config: { ...s, adminSenha: undefined } });
});

router.post('/email/teste', async (req, res) => {
  const { email } = req.body || {};
  if (!email?.includes('@')) return res.status(400).json({ error: 'informe um e-mail válido' });
  const r = await sendEmail({ to: email, subject: 'Teste — Oferta Fit BR ✅', html: emailTeste() });
  res.json({ ok: true, ...r });
});

export default router;
