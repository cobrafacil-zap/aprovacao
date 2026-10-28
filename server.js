// Entrada para DESENVOLVIMENTO LOCAL: npm start → http://localhost:3000
// (Na Vercel, quem atende é api/[...path].js + o cron do vercel.json.)
import app from './src/app.js';
import { liberarPendentes, marcarAbandonados } from './src/lib/release.js';
import { usaRedis } from './src/lib/db.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log('\n🥗 Oferta Fit BR no ar');
  console.log(`   Vendas:   http://localhost:${PORT}/`);
  console.log(`   Checkout: http://localhost:${PORT}/checkout.html`);
  console.log(`   Membros:  http://localhost:${PORT}/membros.html`);
  console.log(`   Admin:    http://localhost:${PORT}/admin.html  (senha: ${process.env.ADMIN_SENHA || 'Comsoc1#'})`);
  console.log(`   Banco:    ${usaRedis ? 'Upstash Redis (produção)' : 'arquivos JSON (dev)'}\n`);

  // liberação semanal: no boot + a cada 10 minutos (no dev; na Vercel é o cron)
  try { await liberarPendentes(); } catch (e) { console.error('[RELEASE]', e.message); }
  setInterval(() => liberarPendentes().catch((e) => console.error('[RELEASE]', e.message)), 10 * 60 * 1000);
  setInterval(() => marcarAbandonados().catch(() => {}), 15 * 60 * 1000);
});
