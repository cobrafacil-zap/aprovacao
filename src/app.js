// Aplicação Express compartilhada:
//   • desenvolvimento local → server.js (npm start)
//   • produção Vercel       → api/index.js (função serverless via rewrite)
// express-async-errors: erros em handlers/middlewares async viram 500 JSON
// em vez de travar a requisição (comportamento do Express 4 puro).
import 'express-async-errors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import publicRoutes from './routes/public.js';
import checkoutRoutes from './routes/checkout.js';
import membersRoutes from './routes/members.js';
import adminRoutes from './routes/admin.js';
import emailsRoutes from './routes/emails.js';
import { liberarPendentes, marcarAbandonados } from './lib/release.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

// Rota de cron (Vercel Cron → ver vercel.json). Protegida por CRON_SECRET.
app.get('/api/cron', async (req, res) => {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  const liberadas = await liberarPendentes().catch((e) => ({ liberadas: 0, erro: e.message }));
  const abandonados = await marcarAbandonados().catch(() => 0);
  res.json({ ok: true, ...liberadas, abandonados });
});

// APIs
app.use('/api', publicRoutes);
app.use('/api/emails', emailsRoutes); // cancelar/reativar inscrição (link dos e-mails)
app.use('/api/checkout', checkoutRoutes);
app.use('/api/membros', membersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'rota não encontrada' }));

// Estático (desenvolvimento local — na Vercel quem serve é o próprio CDN)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res) => res.status(404).send('Página não encontrada'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERRO]', err);
  res.status(500).json({ error: 'erro interno do servidor' });
});

export default app;
