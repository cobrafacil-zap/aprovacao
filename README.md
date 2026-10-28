# 🥗 Oferta Fit BR — Área de membros de receitas fit

Site de venda de produto digital de baixo ticket: **receitas fit em área de membros**,
com **acesso vitalício**, **atualização semanal** e preço único de **R$ 19,90**.
Arquitetura espelhada do projeto P (Express + páginas estáticas + JSON como banco),
ampliada com área de membros, liberação semanal automática e analytics próprio.

**Stack:** Node.js + Express • HTML/CSS/JS puro (sem framework) • JSON em `/data` • nodemailer/Resend

---

## ▶️ Rodar local (2 min)

```bash
cd Ofertafitreceitas
npm i
npm start
# Vendas:   http://localhost:3000/
# Checkout: http://localhost:3000/checkout.html
# Membros:  http://localhost:3000/membros.html  (login/cadastro em /login.html)
# Admin:    http://localhost:3000/admin.html    (senha padrão: admin123)
```

Configuração opcional: copie `.env.example` para `.env` (senha do admin, SMTP/Resend, Mercado Pago).

---

## 📁 Estrutura de pastas e páginas

```
Ofertafitreceitas/
├── server.js                  # Servidor Express + cron de liberação semanal (10 min) e abandono (15 min)
├── package.json               # dependências: express, multer, nodemailer
├── .env.example               # variáveis: PORT, ADMIN_SENHA, SMTP/Resend, Mercado Pago
│
├── src/
│   ├── lib/
│   │   ├── db.js              # banco JSON (data/*.json) com escrita atômica
│   │   ├── auth.js            # sessões por cookie, scrypt, middlewares membro/admin
│   │   ├── mail.js            # e-mail (Resend → SMTP → simulado) + templates
│   │   ├── release.js         # liberação semanal automática + abandono de checkout
│   │   └── analytics.js       # eventos + agregação (visitas, conversão, origem do tráfego)
│   └── routes/
│       ├── public.js          # /api/produto, /api/receitas/preview, /api/track
│       ├── checkout.js        # /api/checkout/pedidos (Pix/cartão/boleto), aprovação, /api/checkout/webhook
│       ├── members.js         # /api/membros/* (conta, receitas, favoritos, lista, histórico)
│       └── admin.js           # /api/admin/* (receitas, alunos, pedidos, métricas, config)
│
├── public/                    # tudo que o navegador baixa (servido estaticamente)
│   ├── index.html             # 📣 PÁGINA DE VENDAS (12 seções — ver abaixo)
│   ├── checkout.html          # 💳 CHECKOUT Pix/cartão/boleto + garantia 7 dias
│   ├── obrigado.html          # ✅ Confirmação + próximo passo
│   ├── login.html             # 🔑 Login / cadastro / definir senha (pós-compra)
│   ├── membros.html           # 👥 ÁREA DE MEMBROS (receitas, favoritos, lista, histórico)
│   ├── admin.html             # ⚙️ PAINEL ADMIN (métricas, receitas, alunos, pedidos, config)
│   ├── css/                   # base.css (design system) + vendas.css + membros.css + admin.css
│   ├── js/                    # track.js (analytics) + vendas.js + checkout.js + membros.js + admin.js
│   └── assets/
│       ├── logo.svg           # logo Oferta Fit BR (recriada em SVG)
│       ├── logo.png           # ← COLE AQUI o PNG original da logo (substitui o SVG nos <img>)
│       └── receitas/          # fotos dos pratos (upload pelo admin ou SVGs ilustrativos)
│
├── data/                      # "banco de dados" em JSON (criado/atualizado em tempo real)
│   ├── receitas.json          # receitas (conteúdo completo + data de liberação)
│   ├── users.json             # alunos (acesso, favoritos, histórico, lista de compras)
│   ├── orders.json            # pedidos (Pix/cartão/boleto, status, origem UTM)
│   ├── events.json            # eventos de analytics
│   └── settings.json          # preço, garantia, e-mail de suporte, senha do admin
│
├── CHECKLIST-TESTES.md        # ✅ checklist manual de QA
└── README.md                  # este arquivo
```

---

## 🧩 Módulos funcionais

### 1. Página de vendas (`public/index.html`)
Seções **na ordem do briefing**: headline com promessa concreta → dor do público →
prévia do produto com prints (carregados da API) → o que está incluso → cronograma semanal →
diferenciais → bônus → preço com pagamento único → garantia de 7 dias → FAQ → depoimentos
(espaço marcado para depoimentos reais) → CTA final. **Botão de compra fixo no mobile**
aparece após o hero (tráfego do Instagram).

### 2. Checkout (`public/checkout.html` + `src/routes/checkout.js`)
Pix (QR + copia e cola), cartão e boleto; garantia de 7 dias; pedido registrado em
`data/orders.json` com UTM de origem. **Modo demo** (padrão): aprovação simulada.
**Produção:** `MP_ACCESS_TOKEN` no `.env` → cobrança real no Mercado Pago e aprovação
via `POST /api/checkout/webhook` (que libera o acesso e envia o e-mail).

### 3. Conteúdo de cada receita (`data/receitas.json`)
Foto do prato • nome e descrição curta • tempo de preparo e porções • ingredientes com
quantidades • modo de preparo em passos numerados • tags (café da manhã, almoço, jantar,
lanche, sobremesa, sem glúten, sem lactose, alto proteico, low carb, vegetariano, rápido) •
informação nutricional aproximada (calorias + macros) **com aviso de estimativa**.

### 4. Liberação semanal (`src/lib/release.js`)
Cada receita tem `data_liberacao` e fica **invisível até a data** (API retorna 404).
Um cron no servidor libera automaticamente (a cada 10 min), envia **e-mail de nova receita**
a todos os membros ativos e registra o evento no analytics. O membro vê a **próxima receita**
com contador de dias no topo da área de membros.

### 5. Área de membros (`public/membros.html`)
Busca textual • filtros por categoria e tag • favoritos (❤️) • **lista de compras gerada**
a partir das receitas selecionadas (ingredientes iguais somados) • **modo impressão** de
receita e da lista • histórico de receitas já feitas.

### 6. Painel administrativo (`public/admin.html`)
Senha única (`.env` / `settings.json`). Criação e edição de receitas com **upload de foto**,
**agendamento de publicação** (data/hora) e botão "publicar agora" (dispara o e-mail);
gestão de alunos (liberar/revogar acesso); pedidos; métricas integradas ao analytics;
configurações (preço, garantia, suporte, senha) e teste de e-mail.

### 7. Analytics (`src/lib/analytics.js`)
Próprio e sem cookies de terceiros. Métricas no painel: **visitas**, **conversão da página**,
**checkouts iniciados e abandonados**, **vendas, receita e ticket médio**, **origem do
tráfego** (utm_source: instagram, etc.), dispositivos, série diária e funil de conversão.

---

## 🎨 Visual

Design novo (não replica o projeto P), mobile-first, com a paleta da logo:

| Papel | Cor | Valor |
|---|---|---|
| Primária | Azul | `#2743D6` / `#16266E` |
| Secundária | Amarelo | `#FFC61A` / `#FFF4CC` |
| Destaque/CTA | Vermelho-laranja | `#FF4B2E` |
| Fonte | Poppins (bold, arredondado) | 400–800 |

Para trocar as cores, edite as variáveis em `public/css/base.css` (`:root`).

> **Logo:** o arquivo original está em `public/assets/logo.jpg` e é usado automaticamente
> em todas as páginas (com fallback para `public/assets/logo.svg`, uma recriação vetorial).
> Para trocar, basta sobrescrever `public/assets/logo.jpg` com o novo arquivo.

---

## ✍️ Regras de conteúdo (já aplicadas)

- Nenhuma promessa de emagrecimento garantido ou resultado médico.
- Linguagem de bem-estar e alimentação equilibrada.
- Aviso em rodapé, no modal de cada receita e nos e-mails: conteúdo informativo,
  não substitui nutricionista ou médico; valores nutricionais são estimativas.

---

## 🚀 Publicar na Vercel (arquitetura atual)

O projeto já está preparado para a Vercel: APIs como função serverless
(`api/[...path].js`), banco no **Upstash Redis**, fotos no **Vercel Blob**,
e-mails por **Resend** e liberação semanal pelo **Vercel Cron** (`vercel.json`).

### 1. Crie os recursos gratuitos (painel da Vercel → aba Storage)
- **Upstash for Redis** (Marketplace) → *Create database* → conecte ao projeto
  (as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` entram sozinhas)
- **Blob** → *Create database* → conecte ao projeto (`BLOB_READ_WRITE_TOKEN`)

### 2. Resend (e-mails)
1. Crie a conta em https://resend.com e uma API Key
2. Valide o domínio do remetente (DNS) — sem isso, os e-mails não saem
3. Variáveis: `RESEND_API_KEY` e `FROM_EMAIL`

### 3. Variáveis de ambiente (Settings → Environment Variables)
```
ADMIN_SENHA=Comsoc1#
RESEND_API_KEY=...
FROM_EMAIL=entrega@seudominio.com
PUBLIC_BASE_URL=https://aprovacao-psi.vercel.app
CRON_API_SECRET=<gere um segredo longo>
```
(Opcional, para pagamento real: `MP_ACCESS_TOKEN`. Sem ele, o checkout fica em modo demo.)

### 4. Deploy
Importe o repositório `cobrafacil-zap/aprovacao` na Vercel (preset: *Other*).
- Páginas: servidas pelo CDN (pasta `public/`)
- APIs: `api/[...path].js` (Express dentro da função)
- Cron diário: `/api/cron` faz a liberação semanal + marcação de checkouts abandonados
  (a área de membros também dispara a checagem ao abrir, no máx. 1x a cada 10 min)

> **Banco:** em produção os dados vivem no Upstash Redis (as receitas são semeadas
> automaticamente no primeiro acesso). Em desenvolvimento local (`npm start`),
> o banco são os arquivos JSON em `/data`.
