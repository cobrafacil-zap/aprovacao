// Envio de e-mail: Resend (fetch) → SMTP (nodemailer) → modo simulado (console).
// Templates prontos: boas-vindas, compra aprovada e nova receita semanal.
import { read } from './db.js';

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

const base = (titulo, corpo) => `
<div style="background:#F7F8FC;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E9EDFF">
    <div style="background:#2743D6;padding:18px 24px">
      <span style="color:#FFC61A;font-weight:800;font-size:20px">Oferta Fit BR</span>
    </div>
    <div style="padding:24px;color:#0E1330">
      <h2 style="margin:0 0 12px;font-size:20px">${titulo}</h2>
      ${corpo}
      <p style="color:#5B627E;font-size:12px;margin-top:28px">
        Este conteúdo é informativo e não substitui acompanhamento de nutricionista ou médico.
      </p>
    </div>
    <div style="background:#FFF4CC;padding:14px 24px;font-size:12px;color:#5B627E">
      Oferta Fit BR • acesso vitalício com receitas novas toda semana
    </div>
  </div>
</div>`;

const botao = (url, texto) =>
  `<a href="${url}" style="display:inline-block;background:#FF4B2E;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;margin:16px 0">${texto}</a>`;

export const emailCompra = (nome, urlAcesso) =>
  base(`Tudo certo, ${nome}! 🎉`, `
    <p>Seu pagamento foi aprovado e seu acesso à área de membros já está liberado.</p>
    ${botao(urlAcesso, 'Entrar na área de membros')}
    <p>Lá você já encontra as receitas liberadas e uma nova receita toda semana. Guarde este e-mail!</p>`);

export const emailBoasVindas = (nome, urlAcesso) =>
  base(`Bem-vindo(a) à família Fit, ${nome}! 💪`, `
    <p>Seu acesso é <strong>vitalício</strong> e chega receita nova toda semana.</p>
    ${botao(urlAcesso, 'Acessar agora')}`);

export const emailNovaReceita = (nome, receita, urlReceita) =>
  base(`Saiu receita nova: ${receita.nome} 🥗`, `
    <p>Olá ${nome}, acabou de liberar a receita <strong>${receita.nome}</strong>.</p>
    <p>${receita.descricao || ''}</p>
    <p style="color:#5B627E">⏱ ${receita.tempo_preparo_min} min • 🍽 ${receita.porcoes} porção(ões)</p>
    ${botao(urlReceita, 'Ver a receita completa')}`);

export const emailDefinirSenha = (nome, url) =>
  base(`Crie seu acesso, ${nome}`, `
    <p>Confirme seu e-mail e defina sua senha para entrar na área de membros.</p>
    ${botao(url, 'Definir minha senha')}
    <p style="color:#5B627E">Se você já tem senha, é só entrar normalmente.</p>`);

export function baseUrl() {
  return process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
}

export function urlMembros() {
  return `${baseUrl()}/membros.html`;
}

export function emailDeSuporte() {
  return read('settings', {}).emailSuporte || 'suporte@ofertafitbr.com';
}
