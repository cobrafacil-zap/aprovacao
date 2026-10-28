// Utilitário: cria ou atualiza um usuário/membro no banco (ativo, com senha).
// Uso: node scripts/criar-usuario.mjs email senha [nome]
// Com as variáveis do ambiente (ex.: --env-file=.env.production) grava em produção.
import { read, write, id, agora, usaRedis } from '../src/lib/db.js';
import { hashSenha } from '../src/lib/auth.js';

const [, , email, senha, nome] = process.argv;
if (!email || !senha) {
  console.error('uso: node scripts/criar-usuario.mjs <email> <senha> [nome]');
  process.exit(1);
}

const users = await read('users', []);
let u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
const { salt, hash } = hashSenha(senha);

if (!u) {
  u = {
    id: id('usr'),
    nome: nome || email.split('@')[0],
    email: email.toLowerCase(),
    senhaSalt: salt,
    senhaHash: hash,
    senhaDefinida: true,
    criadoEm: agora(),
    acesso: { ativo: true, liberadoEm: agora(), pedidoId: null },
    favoritos: [],
    feitas: [],
    lista: [],
    ultimaVisita: null,
  };
  users.push(u);
} else {
  u.senhaSalt = salt;
  u.senhaHash = hash;
  u.senhaDefinida = true;
  u.acesso = u.acesso || {};
  u.acesso.ativo = true;
  u.acesso.pendente = false;
}

await write('users', users);
console.log(`usuário pronto (${usaRedis ? 'Upstash/produção' : 'JSON/local'}):`, u.email, '| id:', u.id, '| acesso ativo:', u.acesso.ativo);
