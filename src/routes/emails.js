// Cancelar inscrição nos e-mails de novidades (sem precisar de login).
// O link vem no rodapé de todos os e-mails, com e-mail + token estável.
import { Router } from 'express';
import { read, write } from '../lib/db.js';
import { tokenEmails, urlMembros } from '../lib/mail.js';

const router = Router();

const pagina = (titulo, texto, botao) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo} · OfertaFitBR</title>
  <link rel="icon" type="image/png" href="/assets/logo-favicon.png" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; background: #F7F8FC; margin: 0;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .caixa { background: #fff; border-radius: 18px; padding: 34px 28px; max-width: 460px; width: 100%;
             text-align: center; box-shadow: 0 12px 40px rgba(14, 19, 48, .10); }
    .caixa img { border-radius: 50%; width: 56px; height: 56px; }
    h1 { font-size: 21px; color: #0E1330; margin: 16px 0 10px; }
    p { color: #5B627E; font-size: 15px; line-height: 1.65; margin: 0 0 8px; }
    .btn { display: inline-block; background: #2743D6; color: #fff; text-decoration: none;
           padding: 14px 28px; border-radius: 999px; font-weight: bold; font-size: 15px; margin-top: 14px; }
    small { color: #8A90AE; display: block; margin-top: 18px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="caixa">
    <img src="/assets/logo.jpg" onerror="this.onerror=null;this.src='/assets/logo.svg'" alt="OfertaFitBR" />
    <h1>${titulo}</h1>
    <p>${texto}</p>
    ${botao}
    <small>Livro de Receitas Digital da Núbia · OfertaFitBR<br />
    Dúvidas? Escreva para entrega@ofertafit.smdigtal.com</small>
  </div>
</body>
</html>`;

async function mudarInscricao(req, res, ativo) {
  const email = String(req.query.e || '').toLowerCase().trim();
  const token = String(req.query.t || '');
  if (!email || token !== tokenEmails(email)) {
    return res.status(400).send(pagina(
      'Link inválido',
      'Este link de inscrição não é válido. Confirme se abriu o link completo enviado no e-mail.',
      ''
    ));
  }
  const users = await read('users', []);
  const u = users.find((x) => x.email.toLowerCase() === email);
  if (!u) {
    return res.status(404).send(pagina(
      'Conta não encontrada',
      'Não encontramos nenhuma conta com este e-mail. Você pode simplesmente ignorar as mensagens.',
      ''
    ));
  }
  u.emailsAtivos = ativo;
  await write('users', users);

  if (!ativo) {
    return res.send(pagina(
      'Inscrição cancelada',
      'Pronto! Você não vai mais receber os e-mails de receitas novas e novidades. Os e-mails da sua conta (como acesso e senha) continuam funcionando normalmente.',
      `<a class="btn" href="/api/emails/reativar?e=${encodeURIComponent(email)}&t=${token}">Voltar a receber os e-mails</a>`
    ));
  }
  return res.send(pagina(
    'Inscrição reativada',
    'Pronto! Você volta a receber os avisos de receitas novas por e-mail.',
    `<a class="btn" href="${urlMembros()}">Ir para a área de membros</a>`
  ));
}

router.get('/cancelar', (req, res) => mudarInscricao(req, res, false));
router.get('/reativar', (req, res) => mudarInscricao(req, res, true));

export default router;
