// E-mails do OfertaFitBR: identidade da marca e jornada do cliente.
// Canal principal: RESEND (obrigatório na Vercel). Fallback: SMTP (dev local).
// Sem credenciais: modo simulado (imprime no console, ótimo para testes).
//
// Regras de conteúdo: linguagem de bem-estar, sem promessa de resultado,
// aviso de que não substitui nutricionista/médico em TODOS os e-mails.
import { createHmac } from 'crypto';
import { baseUrl } from './helpers.js';

// Token estável por e-mail (HMAC): permite cancelar a inscrição sem senha
// e sem gravar nada novo no banco.
const SEGREDO_EMAILS = process.env.EMAILS_SECRET || process.env.CRON_SECRET || 'ofertafit-emails-v1';
export const tokenEmails = (email) =>
  createHmac('sha256', SEGREDO_EMAILS).update(String(email).toLowerCase().trim()).digest('hex').slice(0, 32);

export const urlCancelarEmails = (email) =>
  `${baseUrl()}/api/emails/cancelar?e=${encodeURIComponent(email)}&t=${tokenEmails(email)}`;

// Substitui {{CANCELAR}} pelo link do destinatário. Se o endereço não tiver
// conta (e-mails de teste), a linha de cancelamento é removida inteira.
function inserirCancelamento(html, to) {
  if (!String(html).includes('{{CANCELAR}}')) return html;
  return String(html).split('{{CANCELAR}}').join(urlCancelarEmails(to));
}

export async function sendEmail({ to, subject, html }) {
  html = inserirCancelamento(html, to);
  const from = process.env.FROM_EMAIL || 'entrega@ofertafit.smdigtal.com';

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
            <img src="${abs('/assets/logo.jpg')}" alt="OfertaFitBR" width="52" height="52"
                 style="border-radius:50%;display:block" />
          </td></tr>
          <tr><td style="background:#ffffff;padding:30px 28px;font-family:Arial,Helvetica,sans-serif">
            <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0E1330">${titulo}</h1>
            ${corpo}
          </td></tr>
          <tr><td style="background:#16266E;border-radius:0 0 18px 18px;padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#C6CEF7">
            <strong style="color:#FFC61A">Livro de Receitas Digital da Núbia</strong>. Comer melhor sem complicar.<br />
            Dúvidas? Responda este e-mail ou escreva para ${process.env.FROM_EMAIL || 'entrega@ofertafit.smdigtal.com'}.<br /><br />
            <span style="opacity:.85">Este conteúdo é informativo e não substitui acompanhamento de nutricionista ou médico.</span><br />
            <span style="opacity:.85">Não quer mais receber os e-mails de novas receitas?
              <a href="{{CANCELAR}}" style="color:#C6CEF7;text-decoration:underline">Cancelar inscrição</a>.</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

const corpo = (html) => `
  <p style="margin:0 0 12px;font-size:15px;color:#0E1330;line-height:1.65">${html}</p>`;

// Assinatura pessoal da criadora do produto
const assinatura = () => `
  <p style="margin:18px 0 0;font-size:15px;color:#0E1330;line-height:1.65">
    Com carinho,<br />
    <strong style="font-size:16px;color:#2743D6">Núbia</strong><br />
    <span style="color:#5B627E;font-size:13px">Livro de Receitas Digital da Núbia • OfertaFitBR</span>
  </p>`;

// ---------- 1. Pagamento aprovado ----------
export const emailCompra = (nome, urlAcesso) =>
  shell(`Pagamento aprovado! Bem-vindo(a), ${nome} 🎉`, `
    ${corpo('Seu pagamento foi confirmado e o acesso ao <strong>Livro de Receitas Digital da Núbia</strong> <strong>já está liberado</strong>.')}
    ${botao(urlAcesso, 'Entrar na área de membros')}
    <p style="margin:6px 0 4px;font-size:15px;font-weight:bold;color:#0E1330">O que fazer agora:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${passo(1, 'Entre na área de membros', 'Todas as receitas liberadas já estão disponíveis para você.')}
      ${passo(2, 'Escolha uma receita para hoje', 'Use a busca e os filtros por categoria e tags.')}
      ${passo(3, 'Gere sua lista de compras', 'Selecione as receitas e a lista sai pronta para a feira.')}
    </table>
    ${corpo('E fique atenta(o): <strong>toda semana entra uma receita nova</strong> na sua conta. Você recebe um aviso por e-mail quando ela for liberada.')}
    ${assinatura()}
  `);

// ---------- 2. Definir senha (primeiro acesso / redefinição) ----------
export const emailDefinirSenha = (nome, url) =>
  shell(`Crie seu acesso, ${nome} 🔑`, `
    ${corpo('Sua conta já está criada. É só definir uma senha para entrar na área de membros do <strong>Livro de Receitas Digital da Núbia</strong>.')}
    ${botao(url, 'Definir minha senha')}
    ${corpo('<span style="color:#5B627E;font-size:13px">O link é válido por 7 dias. Se você já tem senha, é só ignorar este e-mail e entrar normalmente.</span>')}
  `);

// ---------- 3. Boas-vindas ----------
export const emailBoasVindas = (nome, urlAcesso) =>
  shell(`Bem-vindo(a) ao Livro de Receitas da Núbia, ${nome}! 💪`, `
    ${corpo('Seu acesso é <strong>vitalício</strong>: você paga uma única vez e recebe receitas novas toda semana, para sempre.')}
    ${botao(urlAcesso, 'Começar agora')}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${passo(1, 'Explore a biblioteca', 'Mais de 50 receitas liberadas para todos os momentos: café da manhã, almoço, jantar, lanche e sobremesa.')}
      ${passo(2, 'Marque suas favoritas', 'Toque no ❤️ para guardar as receitas que você mais gosta.')}
      ${passo(3, 'Cozinhe e registre', 'Marque as receitas como feitas e acompanhe sua evolução na cozinha.')}
    </table>
    ${corpo('Qualquer dúvida, é só responder este e-mail, estamos aqui para ajudar.')}
    ${assinatura()}
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

// ---------- 5. Link de acesso (após o primeiro login) ----------
export const emailLinkAcesso = (nome, urlAcesso) =>
  shell(`Acesse por aqui da próxima vez, ${nome} 🔗`, `
    ${corpo('Você acabou de entrar na sua área de membros. Para os seus <strong>próximos acessos</strong>, é só usar o botão abaixo:')}
    ${botao(urlAcesso, 'Acessar minha área de membros')}
    <p style="margin:6px 0 4px;font-size:15px;font-weight:bold;color:#0E1330">Dicas para nunca perder o acesso:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${passo(1, 'Salve este e-mail', 'Deixe-o marcado como favorito na sua caixa de entrada.')}
      ${passo(2, 'Salve a página nos favoritos', 'Abra o link e adicione aos favoritos do navegador.')}
      ${passo(3, 'Use sempre o mesmo e-mail', 'É com ele que sua conta e suas receitas ficam guardadas.')}
    </table>
    ${corpo('<span style="color:#5B627E;font-size:13px">Esqueceu a senha? Na tela de login, toque em “Esqueci minha senha” que enviamos um novo link na hora.</span>')}
    ${assinatura()}
  `);

// ---------- 6. Teste (painel admin) ----------
export const emailTeste = () =>
  shell('Seu e-mail está configurado! ✅', `
    ${corpo('Este é um e-mail de teste do <strong>OfertaFitBR</strong>. Se você está lendo isso, a integração de e-mail está funcionando corretamente.')}
    ${botao(`${baseUrl()}/index.html`, 'Visitar o site')}
  `);
