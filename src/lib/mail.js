// E-mails do Oferta Fit BR — identidade da marca e jornada do cliente.
// Canal principal: RESEND (obrigatório na Vercel). Fallback: SMTP (dev local).
// Sem credenciais: modo simulado (imprime no console — ótimo para testes).
//
// Regras de conteúdo: linguagem de bem-estar, sem promessa de resultado,
// aviso de que não substitui nutricionista/médico em TODOS os e-mails.
import { baseUrl } from './helpers.js';

export async function sendEmail({ to, subject, html }) {
  const from = process.env.FROM_EMAIL || 'entrega@ofertafitbr.com';

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) throw new Error(`Resend: ${await r.text()}`);
    return { enviado: true, via: 'resend' };
  }

  if (process.env.SMTP_HOST) {
    const nodemailer = (await import('nodemailer')).default;
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({ from, to, subject, html });
    return { enviado: true, via: 'smtp' };
  }

  console.log(`[EMAIL simulado] para ${to} | ${subject}`);
  const link = (String(html).match(/href="(https?:\/\/[^"]+)"/) || [])[1];
  if (link) console.log(`[EMAIL simulado] link: ${link}`);
  return { enviado: false, via: 'simulado' };
}

// ---------- utilidades de template ----------
export function urlMembros() {
  return `${baseUrl()}/membros.html`;
}

const abs = (p = '') => (String(p).startsWith('http') ? p : `${baseUrl()}${p}`);

const botao = (url, texto) => `
  <table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0">
    <tr><td align="center" bgcolor="#FF4B2E" style="border-radius:999px">
      <a href="${url}" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;
      font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${texto}</a>
    </td></tr>
  </table>`;

const passo = (n, titulo, texto) => `
  <tr>
    <td width="38" valign="top" style="padding:10px 0">
      <div style="width:30px;height:30px;border-radius:50%;background:#2743D6;color:#fff;font-family:Arial;font-size:14px;font-weight:bold;text-align:center;line-height:30px">${n}</div>
    </td>
    <td valign="top" style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0E1330">
      <strong>${titulo}</strong><br /><span style="color:#5B627E">${texto}</span>
    </td>
  </tr>`;

// Casca comum: cabeçalho com logo + corpo + rodapé com aviso.
export function shell(titulo, corpo) {
  return `
  <div style="background:#F7F8FC;padding:26px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">
          <tr><td style="background:#2743D6;border-radius:18px 18px 0 0;padding:22px 28px">
            <img src="${abs('/assets/logo.jpg')}" alt="Oferta Fit BR" width="52" height="52"
                 style="border-radius:50%;display:block" />
          </td></tr>
          <tr><td style="background:#ffffff;padding:30px 28px;font-family:Arial,Helvetica,sans-serif">
            <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0E1330">${titulo}</h1>
            ${corpo}
          </td></tr>
          <tr><td style="background:#16266E;border-radius:0 0 18px 18px;padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#C6CEF7">
            <strong style="color:#FFC61A">Oferta Fit BR</strong> — comer melhor sem complicar.<br />
            Dúvidas? Responda este e-mail ou escreva para ${process.env.FROM_EMAIL || 'suporte@ofertafitbr.com'}.<br /><br />
            <span style="opacity:.85">Este conteúdo é informativo e não substitui acompanhamento de nutricionista ou médico.</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

const corpo = (html) => `
  <p style="margin:0 0 12px;font-size:15px;color:#0E1330;line-height:1.65">${html}</p>`;

// ---------- 1. Pagamento aprovado ----------
export const emailCompra = (nome, urlAcesso) =>
  shell(`Pagamento aprovado — bem-vindo(a), ${nome}! 🎉`, `
    ${corpo('Seu pagamento foi confirmado e seu acesso à área de membros <strong>já está liberado</strong>.')}
    ${botao(urlAcesso, 'Entrar na área de membros')}
    <p style="margin:6px 0 4px;font-size:15px;font-weight:bold;color:#0E1330">O que fazer agora:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${passo(1, 'Entre na área de membros', 'Todas as receitas liberadas já estão disponíveis para você.')}
      ${passo(2, 'Escolha uma receita para hoje', 'Use a busca e os filtros por categoria e tags.')}
      ${passo(3, 'Gere sua lista de compras', 'Selecione as receitas e a lista sai pronta para a feira.')}
    </table>
    ${corpo('E fique atenta(o): <strong>toda semana entra uma receita nova</strong> na sua conta — você recebe um aviso por e-mail quando ela for liberada.')}
  `);

// ---------- 2. Definir senha (primeiro acesso / redefinição) ----------
export const emailDefinirSenha = (nome, url) =>
  shell(`Crie seu acesso, ${nome} 🔑`, `
    ${corpo('Sua conta já está criada. É só definir uma senha para entrar na área de membros.')}
    ${botao(url, 'Definir minha senha')}
    ${corpo('<span style="color:#5B627E;font-size:13px">O link é válido por 7 dias. Se você já tem senha, é só ignorar este e-mail e entrar normalmente.</span>')}
  `);

// ---------- 3. Boas-vindas ----------
export const emailBoasVindas = (nome, urlAcesso) =>
  shell(`Bem-vindo(a) à família Fit, ${nome}! 💪`, `
    ${corpo('Seu acesso é <strong>vitalício</strong>: você paga uma única vez e recebe receitas novas toda semana, para sempre.')}
    ${botao(urlAcesso, 'Começar agora')}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${passo(1, 'Explore a biblioteca', 'Mais de 50 receitas liberadas: café da manhã, almoço, jantar, lanche e sobremesa.')}
      ${passo(2, 'Marque suas favoritas', 'Toque no ❤️ para guardar as receitas que você mais gosta.')}
      ${passo(3, 'Cozinhe e registre', 'Marque as receitas como feitas e acompanhe sua evolução na cozinha.')}
    </table>
    ${corpo('Qualquer dúvida, é só responder este e-mail — estamos aqui para ajudar.')}
  `);

// ---------- 4. Nova receita da semana ----------
export const emailNovaReceita = (nome, receita, urlReceita) =>
  shell(`Saiu receita nova: ${receita.nome} 🥗`, `
    ${corpo(`Olá ${nome}, acabou de liberar uma receita nova na sua conta:`)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E4E8F5;border-radius:16px;overflow:hidden">
      ${receita.foto ? `<tr><td><img src="${abs(receita.foto)}" alt="${receita.nome}" width="504" style="width:100%;display:block" /></td></tr>` : ''}
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif">
        <strong style="font-size:18px;color:#0E1330">${receita.nome}</strong>
        <p style="margin:8px 0;color:#5B627E;font-size:14px;line-height:1.6">${receita.descricao || ''}</p>
        <p style="margin:0;color:#2743D6;font-size:14px;font-weight:bold">⏱ ${receita.tempo_preparo_min} min &nbsp;•&nbsp; 🍽 ${receita.porcoes} porção(ões)</p>
      </td></tr>
    </table>
    ${botao(urlReceita, 'Ver a receita completa')}
    ${corpo('<span style="color:#5B627E;font-size:13px">Na próxima semana chega mais uma. 🗓</span>')}
  `);

// ---------- 5. Teste (painel admin) ----------
export const emailTeste = () =>
  shell('Seu e-mail está configurado! ✅', `
    ${corpo('Este é um e-mail de teste do <strong>Oferta Fit BR</strong>. Se você está lendo isso, a integração de e-mail está funcionando corretamente.')}
    ${botao(`${baseUrl()}/index.html`, 'Visitar o site')}
  `);
