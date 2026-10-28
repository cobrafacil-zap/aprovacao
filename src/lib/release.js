// Liberação semanal automática.
// Regra: cada receita tem data_liberacao. Ela fica INVISÍVEL até a data chegar.
// Um cron (server.js) chama liberarPendentes() a cada 10 min:
//   1) marca receitas vencidas como "liberada"
//   2) dispara e-mail de nova receita para todos os membros ativos
//   3) registra evento de analytics
import { read, write, agora } from './db.js';
import { sendEmail, emailNovaReceita, urlMembros, baseUrl } from './mail.js';
import { track } from './analytics.js';

export function receitasLiberadas() {
  const agoraTs = Date.now();
  return read('receitas', [])
    .filter((r) => r.ativo !== false && new Date(r.data_liberacao).getTime() <= agoraTs)
    .sort((a, b) => new Date(b.data_liberacao) - new Date(a.data_liberacao));
}

export function proximaReceita() {
  const agoraTs = Date.now();
  return (
    read('receitas', [])
      .filter((r) => r.ativo !== false && new Date(r.data_liberacao).getTime() > agoraTs)
      .sort((a, b) => new Date(a.data_liberacao) - new Date(b.data_liberacao))[0] || null
  );
}

export async function liberarPendentes() {
  const receitas = read('receitas', []);
  const agoraTs = Date.now();
  const saiuAgora = receitas.filter(
    (r) => r.ativo !== false && !r.liberada && new Date(r.data_liberacao).getTime() <= agoraTs
  );
  if (!saiuAgora.length) return { liberadas: 0 };

  saiuAgora.forEach((r) => {
    r.liberada = true;
    r.liberadaEm = agora();
  });
  write('receitas', receitas);

  const membros = read('users', []).filter((u) => u.acesso?.ativo);
  for (const r of saiuAgora) {
    track({ type: 'receita_liberada', receitaId: r.id, origem: 'sistema' });
    for (const u of membros) {
      try {
        await sendEmail({
          to: u.email,
          subject: `Nova receita liberada: ${r.nome} 🥗`,
          html: emailNovaReceita(u.nome, r, `${urlMembros()}?receita=${r.id}`),
        });
      } catch (e) {
        console.error(`[EMAIL] falha para ${u.email}:`, e.message);
      }
    }
    console.log(`[RELEASE] receita liberada: ${r.nome} (e-mail para ${membros.length} membros)`);
  }
  return { liberadas: saiuAgora.length };
}

// Marca como "abandonado" o pedido que ficou esperando pagamento há mais de 30 min.
export function marcarAbandonados() {
  const limite = Date.now() - 30 * 60 * 1000;
  const pedidos = read('orders', []);
  let n = 0;
  pedidos.forEach((p) => {
    if (p.status === 'aguardando' && new Date(p.criadoEm).getTime() < limite) {
      p.status = 'abandonado';
      p.abandonadoEm = agora();
      n++;
    }
  });
  if (n) {
    write('orders', pedidos);
    console.log(`[CHECKOUT] ${n} pedido(s) marcado(s) como abandonado(s)`);
  }
  return n;
}
