// Autenticação simples por cookie (sessões em data/sessions.json).
// Senhas com scrypt + salt. Suporta sessão de MEMBRO e de ADMIN.
import crypto from 'crypto';
import { read, write, id, agora } from './db.js';

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

function sessoes() {
  return read('sessions', []);
}

export function criarSessao(res, usuarioId, tipo = 'membro') {
  const token = id('ses') + crypto.randomBytes(24).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS * 864e5).toISOString();
  const lista = sessoes().filter((s) => s.usuarioId !== usuarioId || s.tipo !== tipo);
  lista.push({ token, usuarioId, tipo, criadoEm: agora(), expiraEm });
  write('sessions', lista);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DIAS * 86400}`);
  return token;
}

export function destruirSessao(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) write('sessions', sessoes().filter((s) => s.token !== token));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}

export function sessaoAtual(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const s = sessoes().find((x) => x.token === token && new Date(x.expiraEm) > new Date());
  return s || null;
}

export function usuarioDaSessao(req) {
  const s = sessaoAtual(req);
  if (!s || s.tipo !== 'membro') return null;
  return read('users', []).find((u) => u.id === s.usuarioId) || null;
}

export function isSessaoAdmin(req) {
  const s = sessaoAtual(req);
  return !!s && s.tipo === 'admin';
}

// ---- Middlewares ----
export function requireMember(req, res, next) {
  const u = usuarioDaSessao(req);
  if (!u) return res.status(401).json({ error: 'faça login para continuar' });
  if (u.acesso?.ativo === false) return res.status(403).json({ error: 'acesso inativo — fale com o suporte' });
  req.usuario = u;
  next();
}

export function requireAdmin(req, res, next) {
  if (!isSessaoAdmin(req)) return res.status(401).json({ error: 'login de administrador necessário' });
  next();
}

// Cria (ou acha) a conta do comprador quando o pagamento cai.
export function garantirConta({ nome, email, senha, pedidoId }) {
  const users = read('users', []);
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
      ultimaVisita: null,
    };
    users.push(u);
    write('users', users);
  } else if (u.acesso?.ativo === false) {
    u.acesso.ativo = true;
    u.acesso.liberadoEm = agora();
    write('users', users);
  }
  return u;
}
