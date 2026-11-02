// Liberação semanal automática.
// Cada receita tem data_liberacao e fica INVISÍVEL até a data chegar.
// A checagem acontece de dois jeitos (economizando comandos):
//   1) Vercel Cron chama /api/cron (diário) — ver vercel.json
//   2) Checagem "preguiçosa" ao abrir a área de membros (no máximo 1x a cada 10 min)
// Quando uma receita libera: marcada como liberada + e-mail para cada membro ativo.
import { read, write, agora, eventoAdd, id } from './db.js';
import { sendEmail, emailNovaReceita, urlMembros } from './mail.js';

const INTERVALO_PREGUICOSO_MS = 10 * 60 * 1000;
let ultimaChecagem = 0;

export async function receitasLiberadas() {
  const agoraTs = Date.now();
  return (await read('receitas', []))
    .filter((r) => r.ativo !== false && new Date(r.data_liberacao).getTime() <= agoraTs)
    .sort((a, b) => new Date(b.data_liberacao) - new Date(a.data_liberacao));
}

export async function proximaReceita() {
  const agoraTs = Date.now();
  return (
    (await read('receitas', []))
      .filter((r) => r.ativo !== false && new Date(r.data_liberacao).getTime() > agoraTs)
      .sort((a, b) => new Date(a.data_liberacao) - new Date(b.data_liberacao))[0] || null
  );
}

export async function liberarPendentes() {
  const receitas = await read('receitas', []);
  const agoraTs = Date.now();
  const saiuAgora = receitas.filter(
    (r) => r.ativo !== false && !r.liberada && new Date(r.data_liberacao).getTime() <= agoraTs
  );
  if (!saiuAgora.length) return { liberadas: 0 };

  saiuAgora.forEach((r) => {
    r.liberada = true;
    r.liberadaEm = agora();
  });
  await write('receitas', receitas);

  for (const r of saiuAgora) {
    await eventoAdd({ id: id('evt'), ts: agora(), tipo: 'receita_liberada', receitaId: r.id, origem: 'sistema' });
    const enviados = await enviarAvisosDeNovaReceita(r);
    console.log(`[RELEASE] receita liberada: ${r.nome} (${enviados.enviados} e-mails, ${enviados.pendentes} pendentes)`);
  }
  return { liberadas: saiuAgora.length };
}

// Aviso de receita nova, com controle de quem JÁ recebeu.
// Grava `emailsEnviados` na receita a cada envio: se o cron estourar o tempo
// de execução no meio, a próxima chamada continua de onde parou, sem repetir
// e-mail para ninguém. Máximo por chamada para caber no limite da Vercel.
export async function enviarAvisosDeNovaReceita(receita, { maxPorChamada = 40 } = {}) {
  const membros = (await read('users', []))
    .filter((u) => u.acesso?.ativo && u.emailsAtivos !== false);
  const jaEnviados = new Set(receita.emailsEnviados || []);
  const fila = membros.filter((u) => !jaEnviados.has(u.id));
  let enviados = 0;

  const gravarProgresso = async () => {
    const receitas = await read('receitas', []);
    const alvo = receitas.find((x) => x.id === receita.id);
    if (alvo) {
      alvo.emailsEnviados = receita.emailsEnviados;
      alvo.emailsPendentes = receita.emailsPendentes === true;
    }
    await write('receitas', receitas);
  };

  receita.emailsPendentes = true; // marca já de início: retomada cobre até falha total
  await gravarProgresso().catch(() => {});

  for (const u of fila.slice(0, maxPorChamada)) {
    try {
      await sendEmail({
        to: u.email,
        subject: `Nova receita liberada: ${receita.nome} 🥗`,
        html: emailNovaReceita(u.nome, receita, `${urlMembros()}?receita=${receita.id}`),
      });
    } catch (e) {
      console.error(`[EMAIL] falha para ${u.email}:`, e.message);
      continue; // não marca como enviado: tenta de novo na próxima
    }
    jaEnviados.add(u.id);
    receita.emailsEnviados = [...jaEnviados];
    enviados += 1;
    // grava de 5 em 5: se a função morrer no meio, nada se perde nem se repete
    if (enviados % 5 === 0) await gravarProgresso().catch(() => {});
  }

  receita.emailsPendentes = fila.length - enviados > 0;
  await gravarProgresso().catch(() => {});
  return { enviados, pendentes: Math.max(0, fila.length - enviados) };
}

// Retomada: receitas liberadas com gente pendente de aviso continuam a fila
// nas próximas chamadas (cron diário ou abertura da área de membros).
export async function retomarAvisosPendentes({ maxPorChamada = 40 } = {}) {
  const [receitas, users] = await Promise.all([read('receitas', []), read('users', [])]);
  const alvos = (users || []).filter((u) => u.acesso?.ativo && u.emailsAtivos !== false);
  if (!alvos.length) return { retomadas: 0 };
  const pendentes = receitas.filter((r) => {
    if (r.ativo === false || !r.liberada) return false;
    const ja = new Set(r.emailsEnviados || []);
    if (!alvos.some((u) => !ja.has(u.id))) return false;
    // Só retoma lote EXPLICITAMENTE pendente (iniciado e não terminado).
    // Receita liberada antes disso nunca dispara e-mail retroativo.
    return r.emailsPendentes === true;
  });
  let retomadas = 0;
  for (const r of pendentes.slice(0, 3)) {
    const { pendentes: restam } = await enviarAvisosDeNovaReceita(r, { maxPorChamada });
    if (restam === 0) retomadas += 1;
  }
  return { retomadas };
}

// Versão "preguiçosa": só roda se a última checagem tem mais de 10 min.
// Evita gastar comandos do Redis a cada página aberta.
export async function liberarPendentesSeNecessario() {
  const agoraTs = Date.now();
  if (agoraTs - ultimaChecagem < INTERVALO_PREGUICOSO_MS) return { liberadas: 0, pulou: true };
  ultimaChecagem = agoraTs;
  return liberarPendentes();
}

// Pedido aguardando pagamento há mais de 30 min vira "abandonado".
export async function marcarAbandonados() {
  const limite = Date.now() - 30 * 60 * 1000;
  const pedidos = await read('orders', []);
  let n = 0;
  pedidos.forEach((p) => {
    if (p.status === 'aguardando' && new Date(p.criadoEm).getTime() < limite) {
      p.status = 'abandonado';
      p.abandonadoEm = agora();
      n++;
    }
  });
  if (n) {
    await write('orders', pedidos);
    console.log(`[CHECKOUT] ${n} pedido(s) marcado(s) como abandonado(s)`);
  }
  return n;
}
