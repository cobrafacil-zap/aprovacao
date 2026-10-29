// Painel administrativo: login, métricas (analytics), receitas (CRUD + foto +
// agendamento), membros & acessos, pedidos e configurações.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const api = async (url, opts = {}) => {
    try {
      const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...(opts.body instanceof FormData ? { headers: {} } : opts) });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok && !dados.error) {
        dados.error = r.status >= 500
          ? `Erro no servidor (HTTP ${r.status}). Tente novamente em instantes.`
          : `Falha na requisição (HTTP ${r.status}).`;
      }
      return { ok: r.ok, ...dados, status: r.status };
    } catch {
      return { ok: false, error: 'Sem conexão com o servidor. (O painel precisa do backend rodando.)', status: 0 };
    }
  };
  const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const put = (url, body) => api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

  // aviso escrito na tela (sem popup)
  let toastTimer;
  function toast(msg, tipo = 'sucesso') {
    let t = document.getElementById('toast-admin');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast-admin';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = `toast-admin visivel ${tipo}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visivel'), 3000);
  }

  // deixa o formulário pronto para cadastrar a PRÓXIMA receita
  function prepararNovaReceita() {
    receitaEditando = null;
    $('#input-foto').value = '';
    fotoNovaSelecionada = false;
    fotoParaEnviar = null;
    $('#titulo-form-receita').textContent = 'Nova receita';
    $('#form-receita').reset();
    $('#rec-id').value = '';
    $('#ingredientes-textarea').value = '';
    $('#passos-textarea').value = '';
    $('#preview-foto').classList.add('oculto');
    $('#upload-texto').textContent = '📷 Clique para enviar a foto do prato';
    const d = new Date(Date.now() + 7 * 864e5);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('#rec-data').value = d.toISOString().slice(0, 16);
    $('#form-receita-card').classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => $('#rec-nome').focus(), 350);
  }
  const dataBR = (s) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  // ================= LOGIN =================
  (async () => {
    const s = await api('/api/admin/sessao');
    if (s.admin) mostrarPainel();
  })();

  $('#form-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await post('/api/admin/login', { senha: $('#senha-admin').value });
    if (r.ok) mostrarPainel();
    else {
      const b = $('#erro-admin');
      b.textContent = r.error || 'Senha incorreta';
      b.classList.remove('oculto');
    }
  });

  $('#btn-sair-admin').addEventListener('click', async () => {
    await post('/api/admin/sair');
    location.reload();
  });

  function mostrarPainel() {
    $('#login-admin').classList.add('oculto');
    $('#painel').classList.remove('oculto');
    carregarMetricas();
    carregarReceitas();
    carregarMembros();
    carregarPedidos();
    carregarConfig();
  }

  // ================= ABAS =================
  $('#abas-admin').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $$('#abas-admin button').forEach((b) => b.classList.toggle('ativo', b === btn));
    ['metricas', 'receitas', 'membros', 'pedidos', 'config'].forEach((a) =>
      $(`#aba-${a}`).classList.toggle('oculto', btn.dataset.aba !== a)
    );
  });

  // ================= MÉTRICAS =================
  async function carregarMetricas() {
    const dias = $('#periodo-metricas').value || 14;
    const m = await api(`/api/admin/metricas?dias=${dias}`);
    if (!m.visitas && m.visitas !== 0) return;

    $('#metricas-cards').innerHTML = [
      ['👁 Visitas', m.visitas, 'sessões no período'],
      ['🧭 Checkouts iniciados', m.checkouts_iniciados, `${m.conversao_pagina}% conversão da página`],
      ['🧾 Checkouts abandonados', m.checkouts_abandonados, `${m.abandono_checkout}% de abandono`],
      ['💰 Vendas', m.vendas, `${m.conversao_vendas}% conversão de vendas`],
      ['📈 Receita', fmt(m.receita), `ticket médio ${fmt(m.ticket_medio)}`],
      ['👥 Membros ativos', m.membros?.ativos ?? 0, `${m.membros?.total ?? 0} contas criadas`],
      ['📚 Receitas liberadas', m.receitas?.liberadas ?? 0, `${m.receitas?.total ?? 0} no total`],
      ['📅 Próxima receita', m.receitas?.proxima ? new Date(m.receitas.proxima.data).toLocaleDateString('pt-BR') : '—', m.receitas?.proxima?.nome || 'sem agendamento'],
    ].map(([rotulo, valor, sub]) => `
      <div class="metrica-card"><div class="valor">${valor}</div><div class="rotulo-m">${rotulo}</div><div class="delta pos">${sub}</div></div>
    `).join('');

    // Gráfico diário
    const max = Math.max(1, ...m.serie.map((d) => Math.max(d.visitas, d.checkouts, d.vendas * 2)));
    $('#grafico-diario').innerHTML = m.serie.map((d) => `
      <div class="barra-wrap" title="${d.data}: ${d.visitas} visitas, ${d.checkouts} checkouts, ${d.vendas} vendas">
        <div style="display:flex;gap:2px;align-items:flex-end;height:100%;width:100%">
          <div class="barra" style="height:${(d.visitas / max) * 100}%"></div>
          <div class="barra checkouts" style="height:${(d.checkouts / max) * 100}%"></div>
          <div class="barra vendas" style="height:${((d.vendas * 2) / max) * 100}%"></div>
        </div>
        <div class="rotulo-b">${d.data.slice(5)}</div>
      </div>`).join('');

    // Origem do tráfego
    const maxO = Math.max(1, ...m.origens.map((o) => o.total));
    $('#lista-origens').innerHTML = m.origens.length
      ? m.origens.map((o) => `
        <div class="linha-o"><span style="min-width:110px">${o.nome}</span>
          <div class="barra-o"><i style="width:${(o.total / maxO) * 100}%"></i></div>
          <strong style="min-width:40px;text-align:right">${o.total}</strong></div>`).join('')
      : '<p class="cinza pequeno">Sem dados no período.</p>';

    // Funil
    const funil = [
      ['Visualizações da LP', m.lp_views || m.visitas],
      ['Checkouts iniciados', m.checkouts_iniciados],
      ['Vendas aprovadas', m.vendas],
      ['Abandonados', m.checkouts_abandonados],
    ];
    const maxF = Math.max(1, ...funil.map((f) => f[1]));
    $('#lista-funil').innerHTML = funil.map(([nome, v]) => `
      <div class="linha-o"><span style="min-width:170px">${nome}</span>
        <div class="barra-o"><i style="width:${(v / maxF) * 100}%;background:${nome.includes('Aband') ? 'var(--vermelho)' : 'var(--azul)'}"></i></div>
        <strong style="min-width:50px;text-align:right">${v}</strong></div>`).join('');
  }
  $('#periodo-metricas').addEventListener('change', carregarMetricas);

  // ================= RECEITAS =================
  let receitaEditando = null;

  async function carregarReceitas() {
    const d = await api('/api/admin/receitas');
    $('#tabela-receitas tbody').innerHTML = d.receitas.map((r) => {
      const agendada = new Date(r.data_liberacao) > new Date(d.agora);
      return `
      <tr>
        <td><strong>${r.nome}</strong><br><small class="cinza">${(r.tags || []).join(' • ') || 'sem tags'}</small></td>
        <td>${r.categoria.replace(/-/g, ' ')}</td>
        <td>${dataBR(r.data_liberacao)}</td>
        <td><span class="status-pill ${agendada ? 'status-agendada' : 'status-liberada'}">${agendada ? '⏳ agendada' : '✓ liberada'}</span></td>
        <td class="acoes">
          <button class="btn-mini-azul" data-editar="${r.id}">Editar</button>
          ${agendada ? `<button class="btn-mini-verde" data-publicar="${r.id}">Publicar agora</button>` : ''}
          <button class="btn-mini-vermelho" data-excluir="${r.id}">Excluir</button>
        </td>
      </tr>`;
    }).join('');

    $$('#tabela-receitas [data-editar]').forEach((b) => b.addEventListener('click', () => editarReceita(b.dataset.editar, d.receitas)));
    $$('#tabela-receitas [data-publicar]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Publicar esta receita agora e enviar o e-mail para todos os membros?')) return;
      const r = await post(`/api/admin/receitas/${b.dataset.publicar}/publicar`);
      toast(r.ok ? `Receita publicada! E-mail enviado para ${r.emails} membro(s).` : 'Erro ao publicar', r.ok ? 'sucesso' : 'erro');
      carregarReceitas();
    }));
    $$('#tabela-receitas [data-excluir]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Excluir esta receita definitivamente?')) return;
      await api(`/api/admin/receitas/${b.dataset.excluir}`, { method: 'DELETE' });
      carregarReceitas();
    }));
  }

  // Guarda APENAS a foto escolhida agora (o input guarda a última seleção
  // e isso reenviava fotos antigas por cima ao salvar outras receitas).
  let fotoNovaSelecionada = false;
  let fotoParaEnviar = null;

  // A Vercel recusa payloads acima de ~4,5 MB — comprimimos a imagem no
  // navegador (máx. 1400px, JPG 82%) para caber sempre e carregar rápido.
  async function comprimirImagem(arquivo, maxLado = 1400, qualidade = 0.82) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = URL.createObjectURL(arquivo);
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', qualidade));
    const nome = (arquivo.name.replace(/\.\w+$/, '') || 'foto') + '.jpg';
    return blob ? new File([blob], nome, { type: 'image/jpeg' }) : arquivo;
  }

  $('#btn-nova-receita').addEventListener('click', prepararNovaReceita);

  function editarReceita(id, lista) {
    const r = lista.find((x) => x.id === id);
    if (!r) return;
    receitaEditando = r;
    $('#input-foto').value = '';
    fotoNovaSelecionada = false;
    $('#titulo-form-receita').textContent = `Editando: ${r.nome}`;
    $('#rec-id').value = r.id;
    $('#rec-nome').value = r.nome;
    $('#rec-descricao').value = r.descricao || '';
    $('#rec-categoria').value = r.categoria;
    $('#rec-tempo').value = r.tempo_preparo_min;
    $('#rec-porcoes').value = r.porcoes;
    $('#rec-dificuldade').value = r.dificuldade || 'facil';
    $('#rec-custo').value = r.custo || 'baixo';
    $('#rec-dicas').value = r.dicas || '';
    const dt = new Date(r.data_liberacao);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    $('#rec-data').value = dt.toISOString().slice(0, 16);
    $('#ingredientes-textarea').value = (r.ingredientes || [])
      .map((i) => (typeof i === 'string' ? i : (i.texto || [i.qtd, i.unidade, i.item].filter(Boolean).join(' '))))
      .join('\n');
    $('#passos-textarea').value = (r.passos || []).join('\n');
    if (r.foto) {
      $('#preview-foto').src = r.foto;
      $('#preview-foto').classList.remove('oculto');
      $('#upload-texto').classList.add('oculto');
    }
    $('#form-receita-card').classList.remove('oculto');
    $('#form-receita-card').scrollIntoView({ behavior: 'smooth' });
  }

  $('#btn-cancelar-receita').addEventListener('click', () => $('#form-receita-card').classList.add('oculto'));

  // Upload de foto (preview + envio)
  $('#upload-foto').addEventListener('click', () => $('#input-foto').click());
  $('#input-foto').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    fotoNovaSelecionada = true;
    $('#upload-texto').textContent = 'Processando imagem...';
    try {
      fotoParaEnviar = await comprimirImagem(f);
      $('#preview-foto').src = URL.createObjectURL(fotoParaEnviar);
      $('#preview-foto').classList.remove('oculto');
      $('#upload-texto').textContent = `${fotoParaEnviar.name} — ${Math.round(fotoParaEnviar.size / 1024)} KB (comprimida)`;
    } catch {
      fotoParaEnviar = f;
      $('#preview-foto').src = URL.createObjectURL(f);
      $('#preview-foto').classList.remove('oculto');
      $('#upload-texto').textContent = `${f.name} — ${Math.round(f.size / 1024)} KB`;
    }
  });

  $('#form-receita').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ingredientes = $('#ingredientes-textarea').value.split('\n')
      .map((l) => l.trim()).filter(Boolean)
      .map((linha) => ({ qtd: '', unidade: '', item: linha }));
    const passos = $('#passos-textarea').value.split('\n').map((l) => l.trim()).filter(Boolean);

    if (!$('#rec-data').value) return toast('Informe a data de liberação da receita', 'erro');
    const corpo = {
      nome: $('#rec-nome').value,
      descricao: $('#rec-descricao').value,
      categoria: $('#rec-categoria').value,
      tempo_preparo_min: Number($('#rec-tempo').value),
      porcoes: Number($('#rec-porcoes').value),
      data_liberacao: new Date($('#rec-data').value).toISOString(),
      dificuldade: $('#rec-dificuldade').value,
      custo: $('#rec-custo').value,
      dicas: $('#rec-dicas').value,
      ingredientes,
      passos,
    };

    const btnSalvar = document.querySelector('#form-receita button[type="submit"]');
    const textoOriginal = btnSalvar.textContent;
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';
    let r = receitaEditando
      ? await put(`/api/admin/receitas/${receitaEditando.id}`, corpo)
      : await post('/api/admin/receitas', corpo);
    if (!r.ok) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = textoOriginal;
      return toast(r.error || 'Erro ao salvar receita', 'erro');
    }

    // Upload da foto APENAS se o usuário escolheu uma agora
    const arquivo = fotoNovaSelecionada ? (fotoParaEnviar || $('#input-foto').files[0]) : null;
    let fotoOk = true;
    if (arquivo) {
      btnSalvar.textContent = 'Enviando foto...';
      const fd = new FormData();
      fd.append('foto', arquivo);
      const up = await fetch(`/api/admin/receitas/${r.receita.id}/foto`, { method: 'POST', body: fd });
      const ud = await up.json().catch(() => ({}));
      fotoOk = up.ok;
      if (!up.ok) toast('A foto não foi enviada: ' + (ud.error || `erro ${up.status}`), 'erro');
    }
    btnSalvar.disabled = false;
    btnSalvar.textContent = textoOriginal;
    $('#input-foto').value = '';
    fotoNovaSelecionada = false;
    fotoParaEnviar = null;

    toast(fotoOk ? 'Receita salva! 📸' : 'Receita salva (sem a nova foto).', fotoOk ? 'sucesso' : 'erro');
    prepararNovaReceita();
    carregarReceitas();
  });

  // ================= MEMBROS =================
  async function carregarMembros() {
    const d = await api('/api/admin/membros');
    $('#tabela-membros tbody').innerHTML = d.membros.length
      ? d.membros.map((a) => `
        <tr>
          <td><strong>${a.nome}</strong></td>
          <td>${a.email}</td>
          <td><span class="status-pill ${a.acesso?.ativo ? 'status-pago' : 'status-abandonado'}">${a.acesso?.ativo ? '✓ ativo' : '✕ inativo'}</span></td>
          <td>${dataBR(a.criadoEm)}</td>
          <td>${dataBR(a.ultimaVisita)}</td>
          <td>${a.feitas} receitas</td>
          <td class="acoes">
            <button class="btn-mini-cinza" data-senha="${a.id}">Senha</button>
            <button class="${a.acesso?.ativo ? 'btn-mini-vermelho' : 'btn-mini-verde'}" data-acesso="${a.id}" data-valor="${a.acesso?.ativo ? 'false' : 'true'}">
              ${a.acesso?.ativo ? 'Revogar acesso' : 'Liberar acesso'}
            </button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="cinza">Nenhum membro cadastrado ainda.</td></tr>';

    $$('#tabela-membros [data-senha]').forEach((b) => b.addEventListener('click', async () => {
      const senha = prompt('Defina a nova senha para este membro (mín. 6 caracteres):');
      if (!senha) return;
      const r = await post(`/api/admin/membros/${b.dataset.senha}/senha`, { senha });
      toast(r.ok ? 'Senha definida com sucesso!' : r.error || 'Erro ao definir senha', r.ok ? 'sucesso' : 'erro');
    }));

    $$('#tabela-membros [data-acesso]').forEach((b) => b.addEventListener('click', async () => {
      await post(`/api/admin/membros/${b.dataset.acesso}/acesso`, { ativo: b.dataset.valor === 'true' });
      carregarMembros();
    }));
  }

  // ================= PEDIDOS =================
  async function carregarPedidos() {
    const d = await api('/api/admin/pedidos');
    $('#tabela-pedidos tbody').innerHTML = d.pedidos.length
      ? d.pedidos.map((p) => `
        <tr>
          <td><small>${p.id}</small></td>
          <td><strong>${p.nome}</strong><br><small class="cinza">${p.email}</small></td>
          <td>${fmt(p.valor)}</td>
          <td>${p.metodo}</td>
          <td><span class="status-pill status-${p.status === 'pago' ? 'pago' : p.status === 'abandonado' ? 'abandonado' : 'aguardando'}">${p.status}</span></td>
          <td>${dataBR(p.criadoEm)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="cinza">Nenhum pedido ainda.</td></tr>';
  }

  // ================= CONFIG =================
  async function carregarConfig() {
    const d = await api('/api/admin/config');
    const c = d.config || {};
    $('#cfg-nome').value = c.nomeProduto || 'Oferta Fit BR';
    $('#cfg-preco').value = c.preco ?? 19.9;
    $('#cfg-preco-antigo').value = c.precoAntigo ?? 97;
    $('#cfg-garantia').value = c.garantiaDias ?? 7;
    $('#cfg-suporte').value = c.emailSuporte || '';
  }

  $('#form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await put('/api/admin/config', {
      nomeProduto: $('#cfg-nome').value,
      preco: Number($('#cfg-preco').value),
      precoAntigo: Number($('#cfg-preco-antigo').value),
      garantiaDias: Number($('#cfg-garantia').value),
      emailSuporte: $('#cfg-suporte').value,
      adminSenha: $('#cfg-admin-senha').value || undefined,
    });
    toast(r.ok ? 'Configurações salvas!' : (r.error || 'Erro ao salvar'), r.ok ? 'sucesso' : 'erro');
    $('#cfg-admin-senha').value = '';
  });

  $('#btn-teste-email').addEventListener('click', async () => {
    const r = await post('/api/admin/email/teste', { email: $('#teste-email').value });
    $('#status-email').textContent = r.ok
      ? r.enviado ? '✅ E-mail enviado com sucesso!' : 'ℹ️ Modo simulado (configure SMTP/Resend no .env para envio real).'
      : r.error || 'Erro ao enviar';
  });
})();
