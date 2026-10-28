// Autenticação por cookie — cada sessão é uma chave com TTL no banco
// (1 comando Redis por operação; a expiração é automática, sem limpeza manual).
// Senhas com scrypt + salt. Sessões de MEMBRO e de ADMIN.
import crypto from 'crypto';
import { read, write, id, agora, sessaoGet, sessaoSet, sessaoDelete } from './db.js';

const SESSION_COOKIE = 'of_session';
const DIAS = 30;

export function hashSenha(senha, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return { salt, hash };
}

export function conferirSenha(senha, salt, hash) {
  const calc = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export async function criarSessao(res, usuarioId, tipo = 'membro') {
  const token = id('ses') + crypto.randomBytes(24).toString('hex');
  await sessaoSet(token, { usuarioId, tipo, criadoEm: agora() }, DIAS);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DIAS * 86400}`);
  return token;
}

export async function destruirSessao(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await sessaoDelete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}

export async function sessaoAtual(req) {
  return sessaoGet(parseCookies(req)[SESSION_COOKIE]);
}

export async function usuarioDaSessao(req) {
  const s = await sessaoAtual(req);
  if (!s || s.tipo !== 'membro') return null;
  const users = await read('users', []);
  return users.find((u) => u.id === s.usuarioId) || null;
}

export async function isSessaoAdmin(req) {
  const s = await sessaoAtual(req);
  return !!s && s.tipo === 'admin';
}

// ---- Middlewares ----
export async function requireMember(req, res, next) {
  const u = await usuarioDaSessao(req);
  if (!u) return res.status(401).json({ error: 'faça login para continuar' });
  if (u.acesso?.ativo === false) return res.status(403).json({ error: 'acesso inativo — fale com o suporte' });
  req.usuario = u;
  next();
}

export async function requireAdmin(req, res, next) {
  if (!(await isSessaoAdmin(req))) return res.status(401).json({ error: 'login de administrador necessário' });
  next();
}

// Cria (ou reativa) a conta do comprador quando o pagamento cai.
export async function garantirConta({ nome, email, senha, pedidoId }) {
  const users = await read('users', []);
  let u = users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
  if (!u) {
    const { salt, hash } = senha ? hashSenha(senha) : hashSenha(crypto.randomBytes(16).toString('hex'));
    u = {
      id: id('usr'),
      nome: nome || 'Aluno',
      email: String(email).toLowerCase(),
      senhaSalt: salt,
      senhaHash: hash,
      senhaDefinida: !!senha,
      criadoEm: agora(),
      acesso: { ativo: true, liberadoEm: agora(), pedidoId: pedidoId || null },
      favoritos: [],
      feitas: [],
      lista: [],
      ultimaVisita: null,
    };
    users.push(u);
    await write('users', users);
  } else if (u.acesso?.ativo === false) {
    u.acesso.ativo = true;
    u.acesso.pendente = false;
    u.acesso.liberadoEm = agora();
    await write('users', users);
  }
  return u;
}
