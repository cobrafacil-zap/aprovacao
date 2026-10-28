// Gera a pré-visualização de cada e-mail em public/_preview-emails/ (para revisão visual).
// Uso: node scripts/preview-emails.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  emailCompra, emailDefinirSenha, emailBoasVindas, emailNovaReceita, emailTeste,
} from '../src/lib/mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saida = path.join(__dirname, '..', 'public', '_preview-emails');
fs.mkdirSync(saida, { recursive: true });

const receitaExemplo = {
  nome: 'Bowl de Frango com Quinoa',
  descricao: 'Almoço completo, equilibrado e colorido — proteína, carboidrato bom e legumes em uma travessa só.',
  tempo_preparo_min: 30,
  porcoes: 2,
  foto: '/assets/receitas/bowl-frango-quinoa.jpg',
};

const base = 'https://ofertafit.smdigtal.com';
const paginas = {
  '1-compra-aprovada': emailCompra('Maria', `${base}/membros.html`),
  '2-definir-senha': emailDefinirSenha('Maria', `${base}/login.html?definir=usr_xxx.tk_xxx`),
  '3-boas-vindas': emailBoasVindas('Maria', `${base}/membros.html`),
  '4-nova-receita': emailNovaReceita('Maria', receitaExemplo, `${base}/membros.html?receita=rec_bowl_frango_quinoa`),
  '5-teste': emailTeste(),
};

for (const [nome, html] of Object.entries(paginas)) {
  fs.writeFileSync(path.join(saida, `${nome}.html`), html);
  console.log('gerado:', nome + '.html');
}
