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
      alert(r.ok ? `Receita publicada! E-mail enviado para ${r.emails} membro(s).` : 'Erro ao publicar');
      carregarReceitas();
    }));
    $$('#tabela-receitas [data-excluir]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Excluir esta receita definitivamente?')) return;
      await api(`/api/admin/receitas/${b.dataset.excluir}`, { method: 'DELETE' });
      carregarReceitas();
    }));
  }

  // Editors de ingredientes e passos
  const addIngrediente = (qtd = '', un = '', item = '') => {
    const div = document.createElement('div');
    div.className = 'item-lista-editor';
    div.innerHTML = `
      <input class="qtd-inp" placeholder="qtd" value="${qtd}" />
      <input class="un-inp" placeholder="unidade" value="${un}" />
      <input placeholder="ingrediente" value="${item}" />
      <button type="button">✕</button>`;
    div.querySelector('button').addEventListener('click', () => div.remove());
    $('#editor-ingredientes').appendChild(div);
  };
  const addPasso = (texto = '') => {
    const div = document.createElement('div');
    div.className = 'item-lista-editor';
    div.innerHTML = `<input placeholder="descreva o passo" value="${texto}" /><button type="button">✕</button>`;
    div.querySelector('button').addEventListener('click', () => div.remove());
    $('#editor-passos').appendChild(div);
  };
  $('#btn-add-ingrediente').addEventListener('click', () => addIngrediente());
  $('#btn-add-passo').addEventListener('click', () => addPasso());

  $('#btn-nova-receita').addEventListener('click', () => {
    receitaEditando = null;
    $('#titulo-form-receita').textContent = 'Nova receita';
    $('#form-receita').reset();
    $('#rec-id').value = '';
    $('#editor-ingredientes').innerHTML = '';
    $('#editor-passos').innerHTML = '';
    ['#1', '#2', '#3'].forEach(() => addIngrediente());
    ['#1', '#2'].forEach(() => addPasso());
    $('#preview-foto').classList.add('oculto');
    $('#upload-texto').classList.remove('oculto');
    // padrão: liberação daqui a 7 dias (cronograma semanal)
    const d = new Date(Date.now() + 7 * 864e5);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('#rec-data').value = d.toISOString().slice(0, 16);
    $('#form-receita-card').classList.remove('oculto');
    $('#form-receita-card').scrollIntoView({ behavior: 'smooth' });
  });

  function editarReceita(id, lista) {
    const r = lista.find((x) => x.id === id);
    if (!r) return;
    receitaEditando = r;
    $('#titulo-form-receita').textContent = `Editando: ${r.nome}`;
    $('#rec-id').value = r.id;
    $('#rec-nome').value = r.nome;
    $('#rec-descricao').value = r.descricao || '';
    $('#rec-categoria').value = r.categoria;
    $('#rec-tempo').value = r.tempo_preparo_min;
    $('#rec-porcoes').value = r.porcoes;
    $('#rec-tags').value = (r.tags || []).join(', ');
    $('#rec-dificuldade').value = r.dificuldade || 'facil';
    $('#rec-custo').value = r.custo || 'baixo';
    $('#rec-dicas').value = r.dicas || '';
    const dt = new Date(r.data_liberacao);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    $('#rec-data').value = dt.toISOString().slice(0, 16);
    $('#editor-ingredientes').innerHTML = '';
    $('#editor-passos').innerHTML = '';
    (r.ingredientes || []).forEach((i) => addIngrediente(i.qtd, i.unidade, i.item));
    (r.passos || []).forEach((p) => addPasso(p));
    if (!r.ingredientes?.length) addIngrediente();
    if (!r.passos?.length) addPasso();
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
  $('#input-foto').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    $('#preview-foto').src = url;
    $('#preview-foto').classList.remove('oculto');
    $('#upload-texto').textContent = f.name;
  });

  $('#form-receita').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ingredientes = [...$$('#editor-ingredientes .item-lista-editor')].map((d) => {
      const [qtd, unidade, item] = d.querySelectorAll('input');
      return { qtd: qtd.value.trim(), unidade: unidade.value.trim(), item: item.value.trim() };
    }).filter((i) => i.item);
    const passos = [...$$('#editor-passos .item-lista-editor')].map((d) => d.querySelector('input').value.trim()).filter(Boolean);

    const corpo = {
      nome: $('#rec-nome').value,
      descricao: $('#rec-descricao').value,
      categoria: $('#rec-categoria').value,
      tempo_preparo_min: Number($('#rec-tempo').value),
      porcoes: Number($('#rec-porcoes').value),
      data_liberacao: new Date($('#rec-data').value).toISOString(),
      tags: $('#rec-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      dificuldade: $('#rec-dificuldade').value,
      custo: $('#rec-custo').value,
      dicas: $('#rec-dicas').value,
      ingredientes,
      passos,
    };

    let r = receitaEditando
      ? await put(`/api/admin/receitas/${receitaEditando.id}`, corpo)
      : await post('/api/admin/receitas', corpo);
    if (!r.ok) return alert(r.error || 'Erro ao salvar receita');

    // Upload da foto (se houver arquivo novo)
    const arquivo = $('#input-foto').files[0];
    if (arquivo) {
      const fd = new FormData();
      fd.append('foto', arquivo);
      await fetch(`/api/admin/receitas/${r.receita.id}/foto`, { method: 'POST', body: fd });
    }

    alert(receitaEditando ? 'Receita atualizada!' : 'Receita criada!');
    $('#form-receita-card').classList.add('oculto');
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
      alert(r.ok ? 'Senha definida com sucesso!' : r.error || 'Erro ao definir senha');
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
    alert(r.ok ? 'Configurações salvas!' : 'Erro ao salvar');
    $('#cfg-admin-senha').value = '';
  });

  $('#btn-teste-email').addEventListener('click', async () => {
    const r = await post('/api/admin/email/teste', { email: $('#teste-email').value });
    $('#status-email').textContent = r.ok
      ? r.enviado ? '✅ E-mail enviado com sucesso!' : 'ℹ️ Modo simulado (configure SMTP/Resend no .env para envio real).'
      : r.error || 'Erro ao enviar';
  });
})();
