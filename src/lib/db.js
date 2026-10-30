// Banco de dados com DOIS backends e a MESMA interface:
//   1) Upstash Redis (REST via fetch) — produção na Vercel
//      (KV_REST_API_URL/KV_REST_API_TOKEN ou UPSTASH_REDIS_REST_URL/TOKEN)
//   2) Arquivos JSON em /data — desenvolvimento local (npm start)
//
// ECONOMIA DE COMANDOS (plano grátis do Upstash é limitado):
//   • eventos de analytics = 1 comando por evento (LPUSH + LTRIM), sem reescrever a tabela
//   • sessões = 1 comando por operação, chave individual com TTL (expiração automática)
//   • receitas/settings = cache em memória por 60s (mudam raramente)
//   • users/orders = leitura direta (poucos acessos, precisam de frescor)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
export const usaRedis = !!REDIS_URL;

const MAX_EVENTOS = 5000;
const CACHE_TTL_MS = 60 * 1000;
const TABELAS_COM_CACHE = new Set(['receitas', 'settings']);

// ---------- transporte Redis (REST) ----------
async function kv(...args) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(`Redis: ${j.error}`);
  return j.result;
}

// ---------- cache em memória (tabelas estáveis) ----------
const cache = new Map(); // nome -> { valor, expira }
function cacheGet(nome) {
  if (!TABELAS_COM_CACHE.has(nome)) return null;
  const c = cache.get(nome);
  return c && c.expira > Date.now() ? c.valor : null;
}
function cacheSet(nome, valor) {
  if (TABELAS_COM_CACHE.has(nome)) cache.set(nome, { valor, expira: Date.now() + CACHE_TTL_MS });
}

// ---------- tabelas genéricas (users, orders, receitas, settings) ----------
const arquivoDe = (nome) => path.join(DATA_DIR, `${nome}.json`);

export async function read(nome, fallback) {
  const emCache = cacheGet(nome);
  if (emCache) return emCache;

  if (usaRedis) {
    const v = await kv('GET', `ofdb:${nome}`);
    if (v == null || v === '') {
      // primeiro acesso em produção: semeia a partir do arquivo local (receitas/settings)
      const seed = lerSeedLocal(nome);
      if (seed) {
        await kv('SET', `ofdb:${nome}`, JSON.stringify(seed));
        cacheSet(nome, seed);
        return seed;
      }
      return fallback;
    }
    let valor;
    try { valor = JSON.parse(v); } catch { valor = fallback; }
    cacheSet(nome, valor);
    return valor;
  }

  try {
    const valor = JSON.parse(fs.readFileSync(arquivoDe(nome), 'utf8'));
    cacheSet(nome, valor);
    return valor;
  } catch {
    return fallback;
  }
}

// Seed inicial (só usado uma vez, quando a chave ainda não existe no Redis)
function lerSeedLocal(nome) {
  if (!['receitas', 'settings'].includes(nome)) return null;
  try {
    return JSON.parse(fs.readFileSync(arquivoDe(nome), 'utf8'));
  } catch {
    return null;
  }
}

export async function write(nome, dados) {
  cache.delete(nome);
  if (usaRedis) {
    await kv('SET', `ofdb:${nome}`, JSON.stringify(dados));
    cacheSet(nome, dados);
    return dados;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const arquivo = arquivoDe(nome);
  const tmp = `${arquivo}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2));
  fs.renameSync(tmp, arquivo);
  cacheSet(nome, dados);
  return dados;
}

export async function update(nome, fallback, fn) {
  const dados = await read(nome, fallback);
  const resultado = fn(dados);
  await write(nome, dados);
  return resultado;
}

// ---------- sessões (chave por token + TTL: 1 comando por operação) ----------
const sessoesLocal = new Map(); // dev: token -> { dados, expira }

export async function sessaoGet(token) {
  if (!token) return null;
  if (usaRedis) {
    const v = await kv('GET', `ofdb:sess:${token}`);
    return v ? JSON.parse(v) : null;
  }
  const s = sessoesLocal.get(token);
  return s && s.expira > Date.now() ? s.dados : null;
}

export async function sessaoSet(token, dados, dias = 30) {
  if (usaRedis) {
    await kv('SET', `ofdb:sess:${token}`, JSON.stringify(dados), 'EX', Math.round(dias * 86400));
    return;
  }
  sessoesLocal.set(token, { dados, expira: Date.now() + dias * 864e5 });
}

export async function sessaoDelete(token) {
  if (usaRedis) {
    await kv('DEL', `ofdb:sess:${token}`);
    return;
  }
  sessoesLocal.delete(token);
}

// ---------- eventos de analytics (lista: 1 comando por evento) ----------
export async function eventoAdd(evt) {
  const linha = JSON.stringify(evt);
  if (usaRedis) {
    await kv('LPUSH', 'ofdb:events', linha);
    await kv('LTRIM', 'ofdb:events', 0, MAX_EVENTOS - 1);
    return;
  }
  const eventos = JSON.parse(fs.readFileSync(arquivoDe('events'), 'utf8') || '[]');
  eventos.push(evt);
  fs.writeFileSync(arquivoDe('events'), JSON.stringify(eventos.slice(-MAX_EVENTOS), null, 2));
}

export async function eventoLista(limite = MAX_EVENTOS) {
  if (usaRedis) {
    const linhas = await kv('LRANGE', 'ofdb:events', 0, limite - 1);
    return (linhas || []).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  try {
    return JSON.parse(fs.readFileSync(arquivoDe('events'), 'utf8') || '[]').slice(-limite);
  } catch {
    return [];
  }
}

// ---------- utilidades ----------
import crypto from 'crypto';

export function id(prefixo = 'id') {
  // criptograficamente aleatório: os ids aparecem em URLs de pedido/acesso
  return `${prefixo}_${crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// Trava com expiração: só quem consegue criar passa (evita aprovar o mesmo
// pedido duas vezes quando webhook e polling chegam juntos).
export async function setNx(chave, segundos = 120) {
  if (usaRedis) {
    const v = await kv('SET', chave, '1', 'NX', 'EX', segundos);
    return v === 'OK';
  }
  if (globalThis.__travas?.has(chave)) return false;
  (globalThis.__travas ||= new Set()).add(chave);
  setTimeout(() => globalThis.__travas.delete(chave), segundos * 1000).unref?.();
  return true;
}

export function agora() {
  return new Date().toISOString();
}
