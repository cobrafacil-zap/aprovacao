#!/usr/bin/env python3
def aplicar(p, pares):
    t = open(p).read()
    for a, b in pares:
        if a not in t:
            print('  ! nao achou em', p, ':', a[:64])
        t = t.replace(a, b)
    open(p, 'w').write(t)
    print('ok:', p)

# ---------- chamadas de aprovarPedido agora passam só o pedido ----------
aplicar('src/routes/checkout.js', [
  ("await aprovarPedido(p, pedidos);", "await aprovarPedido(p);"),
])

# ---------- S4/O1: progresso gravado durante o envio + retomada automática ----------
aplicar('src/lib/release.js', [
  ("""  for (const u of fila.slice(0, maxPorChamada)) {
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
  }

  if (enviados) {
    // grava o progresso mesmo sem ter terminado todo mundo
    const receitas = await read('receitas', []);
    const alvo = receitas.find((x) => x.id === receita.id);
    if (alvo) alvo.emailsEnviados = receita.emailsEnviados;
    await write('receitas', receitas);
  }
  return { enviados, pendentes: Math.max(0, fila.length - enviados) };""",
   """  const gravarProgresso = async () => {
    const receitas = await read('receitas', []);
    const alvo = receitas.find((x) => x.id === receita.id);
    if (alvo) alvo.emailsEnviados = receita.emailsEnviados;
    await write('receitas', receitas);
  };

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

  if (enviados) await gravarProgresso();
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
    return alvos.some((u) => !ja.has(u.id));
  });
  let retomadas = 0;
  for (const r of pendentes.slice(0, 3)) {
    const { pendentes: restam } = await enviarAvisosDeNovaReceita(r, { maxPorChamada });
    if (restam === 0) retomadas += 1;
  }
  return { retomadas };
}"""),
  # cron deixa de perder aviso quando a fila não cabe em uma execução
  ("""  const liberadas = await liberarPendentes().catch((e) => ({ liberadas: 0, erro: e.message }));""",
   """  const liberadas = await liberarPendentes().catch((e) => ({ liberadas: 0, erro: e.message }));
  const retomadas = await retomarAvisosPendentes().catch(() => ({ retomadas: 0 }));"""),
])

aplicar('src/app.js', [
  ("import { liberarPendentes, marcarAbandonados } from './lib/release.js';",
   "import { liberarPendentes, marcarAbandonados, retomarAvisosPendentes } from './lib/release.js';"),
])

# ---------- S5: escape nos pontos que faltavam ----------
aplicar('public/js/membros.js', [
  ('<div><strong>${r.nome}</strong><span class="de-receita">',
   '<div><strong>${esc(r.nome)}</strong><span class="de-receita">'),
  ('<span class="cat-badge">${(r.categoria || \'\').replace(/-/g, \' \')}</span>',
   '<span class="cat-badge">${esc((r.categoria || \'\').replace(/-/g, \' \'))}</span>'),
  ('<span>📂 ${r.categoria.replace(/-/g, \' \')}</span>',
   '<span>📂 ${esc(r.categoria.replace(/-/g, \' \'))}</span>'),
  ("""<div class="nutri"><strong>${({facil:'Fácil',media:'Média',dificil:'Difícil'})[r.dificuldade] || r.dificuldade}</strong><span>dificuldade</span></div>""",
   """<div class="nutri"><strong>${esc(({facil:'Fácil',media:'Média',dificil:'Difícil'})[r.dificuldade] || r.dificuldade)}</strong><span>dificuldade</span></div>"""),
  ("""<div class="nutri"><strong>${({baixo:'Baixo',medio:'Médio',alto:'Alto'})[r.custo] || r.custo}</strong><span>custo estimado</span></div>""",
   """<div class="nutri"><strong>${esc(({baixo:'Baixo',medio:'Médio',alto:'Alto'})[r.custo] || r.custo)}</strong><span>custo estimado</span></div>"""),
  ("""<span class="texto"><strong class="qtd">${[i.qtd, unidadePorExtenso(i.unidade, i.qtd)].filter(Boolean).join(' ') || ''}</strong> ${i.item}</span>""",
   """<span class="texto"><strong class="qtd">${esc([i.qtd, unidadePorExtenso(i.unidade, i.qtd)].filter(Boolean).join(' ') || '')}</strong> ${esc(i.item)}</span>"""),
  ("""<span class="de-receita">${(i.receitas || []).join(' • ')}</span>""",
   """<span class="de-receita">${(i.receitas || []).map(esc).join(' • ')}</span>"""),
])

aplicar('public/js/receita.js', [
  ("""${r.dificuldade ? `<div class="nutri"><strong>${rotulo[r.dificuldade] || r.dificuldade}</strong><span>dificuldade</span></div>` : ''}""",
   """${r.dificuldade ? `<div class="nutri"><strong>${esc(rotulo[r.dificuldade] || r.dificuldade)}</strong><span>dificuldade</span></div>` : ''}"""),
  ("""${r.custo ? `<div class="nutri"><strong>${rotulo[r.custo] || r.custo}</strong><span>custo estimado</span></div>` : ''}""",
   """${r.custo ? `<div class="nutri"><strong>${esc(rotulo[r.custo] || r.custo)}</strong><span>custo estimado</span></div>` : ''}"""),
  ("""<span class="cat-badge">${(x.categoria || '').replace(/-/g, ' ')}</span>""",
   """<span class="cat-badge">${esc((x.categoria || '').replace(/-/g, ' '))}</span>"""),
])

aplicar('public/js/admin.js', [
  ('${m.receitas?.proxima?.nome || \'sem agendamento\'}', '${esc(m.receitas?.proxima?.nome || \'sem agendamento\')}'),
  ('<td>${r.categoria.replace(/-/g, \' \')}</td>', '<td>${esc(r.categoria.replace(/-/g, \' \'))}</td>'),
])

# checkout: valores do Mercado Pago escapados + link só https
aplicar('public/js/checkout.js', [
  ('`${d.pix?.copiaECola || \'\'}`', '`${esc(d.pix?.copiaECola || \'\')}`'),
  ('<div class="qr-demo"', '<div class="qr-demo"'),
  ('${d.cartao?.detalhe ? `<p class="pequeno cinza">${d.cartao.detalhe}</p>` : \'\'}',
   '${d.cartao?.detalhe ? `<p class="pequeno cinza">${esc(d.cartao.detalhe)}</p>` : \'\'}'),
  ('${d.boleto.linhaDigitavel}', '${esc(d.boleto.linhaDigitavel)}'),
])
