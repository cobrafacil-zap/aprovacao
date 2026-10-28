// Oferta Fit BR — servidor principal.
// Espelha a arquitetura do projeto P (Express + estáticos + JSON como banco),
// acrescentando área de membros, liberação semanal e analytics.
//
// Rodar: npm i && npm start  →  http://localhost:3000
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import publicRoutes from './src/routes/public.js';
import checkoutRoutes from './src/routes/checkout.js';
import membersRoutes from './src/routes/members.js';
import adminRoutes from './src/routes/admin.js';
import { liberarPendentes, marcarAbandonados } from './src/lib/release.js';
import { limparSessoes } from './src/lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// APIs
app.use('/api', publicRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/membros', membersRoutes);
app.use('/api/admin', adminRoutes);

// fallback amigável para páginas
app.use((req, res) => res.status(404).send('Página não encontrada'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERRO]', err);
  res.status(500).json({ error: 'erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🥗 Oferta Fit BR no ar`);
  console.log(`   Vendas:   http://localhost:${PORT}/`);
  console.log(`   Checkout: http://localhost:${PORT}/checkout.html`);
  console.log(`   Membros:  http://localhost:${PORT}/membros.html`);
  console.log(`   Admin:    http://localhost:${PORT}/admin.html  (senha: ${process.env.ADMIN_SENHA || 'admin123'})\n`);

  // liberação semanal automática: no boot + a cada 10 minutos
  const removidas = limparSessoes();
  if (removidas) console.log(`[AUTH] ${removidas} sessão(ões) órfã(s) removida(s)`);
  try { await liberarPendentes(); } catch (e) { console.error('[RELEASE]', e.message); }
  setInterval(() => liberarPendentes().catch((e) => console.error('[RELEASE]', e.message)), 10 * 60 * 1000);
  setInterval(() => marcarAbandonados().catch(() => {}), 15 * 60 * 1000);
});
