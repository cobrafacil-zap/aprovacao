# ✅ Checklist de Testes — Oferta Fit BR

Como rodar: `npm i && npm start` e abra `http://localhost:3000`.
Marque cada item após validar. Use duas janelas (ou aba anônima) para simular o aluno.

---

## 1. 💳 Checkout (Pix, cartão, boleto)

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 1.1 | Criar pedido Pix | LP → "Comprar" → preencher nome/e-mail → Pix → "Finalizar compra" | Painel com QR Code + código copia e cola; pedido em `data/orders.json` com status `aguardando` | ☐ |
| 1.2 | Criar pedido cartão | Escolher cartão sem preencher os campos → "Finalizar" | Mensagem de erro pedindo os dados do cartão; sem pedido criado | ☐ |
| 1.3 | Criar pedido boleto | Escolher boleto → "Finalizar" | Linha digitável exibida + aviso de compensação (até 2 dias úteis) | ☐ |
| 1.4 | Validação de dados | Enviar sem nome ou com e-mail inválido | Erro "Preencha seu nome e um e-mail válido"; nenhum pedido criado | ☐ |
| 1.5 | Copia e cola | Botão "Copiar código Pix" | Copia para a área de transferência e muda o rótulo para "✓ Copiado!" | ☐ |
| 1.6 | Aprovação (demo) | Botão "Simular pagamento aprovado (demo)" | Redireciona para `obrigado.html` com pedido `pago` | ☐ |
| 1.7 | Garantia visível | Inspecionar checkout | Selos de segurança + aviso de garantia de 7 dias | ☐ |
| 1.8 | Webhook (produção) | `curl -X POST /api/checkout/webhook -d '{"external_reference":"<id>","status":"approved"}'` | Pedido vira `pago`, conta criada/liberada e e-mail disparado | ☐ |
| 1.9 | Checkout abandonado | Criar pedido e aguardar 30 min (ou rodar o servidor e esperar o cron de 15 min) | Pedido muda para `abandonado`; aparece em "Checkouts abandonados" nas métricas | ☐ |

## 2. 📅 Liberação semanal

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 2.1 | Receita futura invisível | Admin → criar receita com data futura; logar como membro | Receita **não** aparece na busca nem nos filtros; `/api/membros/receitas/:id` retorna 404 | ☐ |
| 2.2 | Liberação automática | Criar receita com data 1 min no futuro e aguardar (cron roda a cada 10 min, ou reinicie `npm start` que roda no boot) | Receita aparece sozinha para os membros; status vira "liberada" | ☐ |
| 2.3 | E-mail da nova receita | Após a liberação, checar o console (`[EMAIL simulado]`) ou a caixa de entrada (SMTP/Resend) | Cada membro ativo recebe "Nova receita liberada: ..." com link direto para a receita | ☐ |
| 2.4 | Contador da próxima | Abrir a área de membros com receita agendada | Banner "Próxima receita: ..." com contagem em dias e data formatada | ☐ |
| 2.5 | Publicar agora | Admin → receita agendada → "Publicar agora" | Libera imediatamente e envia o e-mail para todos os membros (mostra a quantidade) | ☐ |
| 2.6 | Cronograma semanal | Conferir datas em `data/receitas.json` | Liberações espaçadas de 7 em 7 dias (ex.: segundas 08:00) | ☐ |

## 3. 📧 Envio de e-mail

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 3.1 | Modo simulado | Sem `.env`, fazer uma compra | Console loga `[EMAIL simulado] para ... \| <assunto>` + link | ☐ |
| 3.2 | E-mail de compra | Concluir compra (demo) | Chega "Pagamento aprovado — seu acesso chegou 🎉" com botão para a área de membros | ☐ |
| 3.3 | Definir senha | Compra sem conta prévia | Segundo e-mail com link `login.html?definir=...`; abrir, definir senha e entrar | ☐ |
| 3.4 | Configuração real | Admin → Configurações → "Testar envio de e-mail" | Com SMTP/Resend configurado no `.env`: "✅ E-mail enviado"; sem: aviso de modo simulado | ☐ |
| 3.5 | E-mail com falha | Desligar rede/credenciais inválidas e liberar receita | Erro é logado sem derrubar o servidor; liberação continua funcionando | ☐ |

## 4. 🔓 Acesso após pagamento

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 4.1 | Conta criada automaticamente | Concluir compra com e-mail novo | Conta aparece em Admin → Alunos com acesso **ativo** | ☐ |
| 4.2 | Login do comprador | `login.html` com o e-mail da compra e a senha definida pelo link | Entra na área de membros com a saudação pelo nome | ☐ |
| 4.3 | Área protegida | Abrir `membros.html` em aba anônima sem login | Redireciona para `login.html` (API responde 401) | ☐ |
| 4.4 | Compra com conta existente | Comprar de novo com e-mail já cadastrado | Acesso mantido/liberado; sem duplicar conta | ☐ |
| 4.5 | Revogar acesso | Admin → Alunos → "Revogar acesso" | Membro não consegue mais usar as APIs (403 "acesso inativo") | ☐ |
| 4.6 | Reembolso/garantia | Revogar acesso + (fora do sistema) estornar no gateway | Pedido pode ser marcado como `estornado`; aluno sem acesso | ☐ |

## 5. 📱 Responsividade (mobile primeiro)

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 5.1 | LP em 360px | DevTools → iPhone SE / Moto G | Tudo legível sem rolagem horizontal; CTAs em largura total | ☐ |
| 5.2 | Botão fixo mobile | Rolar a LP no celular | Barra "R$ 19,90 • Comprar agora" aparece após o hero e some no topo | ☐ |
| 5.3 | Checkout no celular | Fluxo completo de compra no celular | Campos confortáveis (16px evita zoom), teclado adequado (inputmode) | ☐ |
| 5.4 | Área de membros | Buscar, filtrar e abrir receita no celular | Cards em 1 coluna; modal sobe de baixo; botões ≥ 44px | ☐ |
| 5.5 | Impressão | Modal da receita → "🖨 Imprimir" (ou Ctrl/Cmd+P) | Sai só a receita (ingredientes, passos, nutrição + aviso), sem menus | ☐ |
| 5.6 | Lista de compras | Gerar lista → imprimir | Sai a lista limpa em papel | ☐ |
| 5.7 | Painel admin | Abrir o admin no celular | Tabelas com rolagem horizontal; abas acessíveis | ☐ |
| 5.8 | Tablet/desktop | 768px e 1280px | Grades de 2–3 colunas; sem sobreposição | ☐ |

## 6. 🧪 Demais funções da área de membros

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 6.1 | Busca textual | Buscar "tapioca", "aveia", tag | Resultado correto (nome, descrição ou tag) | ☐ |
| 6.2 | Filtros | Combinar categoria + tags | Só receitas que atendem a **todos** os filtros | ☐ |
| 6.3 | Favoritos | ❤️ em 2 receitas → aba Favoritos | Aparecem lá; remover volta ao estado inicial | ☐ |
| 6.4 | Lista de compras | Selecionar 2 receitas com ingrediente em comum (ex.: ovos) | Quantidades **somadas** (6 + 2 = 8 un); origem indicada por receita | ☐ |
| 6.5 | Item manual | Adicionar "1 kg de tomate" e marcar/desmarcar | Item entra na lista; checkbox risca o texto; ✕ remove | ☐ |
| 6.6 | Histórico | Marcar receita como "Já fiz essa" | Aparece em "Feitas" com a data; desmarcar remove | ☐ |

## 7. ⚙️ Painel administrativo

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 7.1 | Login | `admin.html` com senha errada / `admin123` | Errada: erro visível. Correta: entra no painel | ☐ |
| 7.2 | CRUD de receita | Criar receita com ingredientes, passos, tags e nutrição | Aparece na tabela e, se liberada, no app do membro | ☐ |
| 7.3 | Upload de foto | Enviar jpg/png/webp até 6MB | Foto aparece na receita (app + LP); arquivo em `public/assets/receitas/` | ☐ |
| 7.4 | Editar receita | Alterar nome/data/ingredientes | Mudanças refletem imediatamente; data futura volta a agendar | ☐ |
| 7.5 | Métricas | Gerar visitas/checkouts/vendas de teste | Cards, gráfico diário, origem do tráfego (instagram, etc.) e funil atualizados | ☐ |
| 7.6 | Configurações | Alterar preço para 24,90 | LP e checkout passam a exibir o novo preço | ☐ |

## 8. 🧭 Analytics

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 8.1 | Pageview + origem | Abrir `/?utm_source=instagram&utm_medium=bio` | Evento registrado; "instagram" aparece em "Origem do tráfego" | ☐ |
| 8.2 | Funil | Fazer LP → checkout → compra | Visita +1, checkout +1, venda +1; conversões calculadas | ☐ |
| 8.3 | Abandono | Deixar checkout sem pagar por 30 min | Contabilizado em "Checkouts abandonados" | ☐ |
| 8.4 | UTM persistente | Entrar com UTM e navegar para o checkout | Origem atribuída ao pedido mesmo sem UTM na URL do checkout | ☐ |

## 9. 🛡️ Conteúdo e conformidade

| # | Teste | Como fazer | Esperado | ✓ |
|---|---|---|---|---|
| 9.1 | Sem promessa de resultado | Ler LP inteira | Nenhuma promessa de emagrecimento garantido/resultado médico | ☐ |
| 9.2 | Avisos legais | Rodapé da LP, modal de receita, e-mails | Aviso de conteúdo informativo + não substitui nutricionista/médico | ☐ |
| 9.3 | Estimativa nutricional | Abrir qualquer receita | Aviso de que os valores são estimativas | ☐ |
| 9.4 | Depoimentos | Seção Depoimentos | Espaço marcado para inserir depoimentos reais antes da campanha | ☐ |
