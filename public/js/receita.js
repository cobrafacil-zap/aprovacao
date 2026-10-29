// Página da receita (todos os aparelhos): foto grande, informações claras,
// ingredientes com check, porções ajustáveis, passos com check, dica
// e recomendações embaixo. Visual simplista e bem legível.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 401) { location.href = 'login.html'; throw new Error('login'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'erro');
    return d;
  };
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body || {}) });

  let toastTimer;
  function toast(msg, tipo = 'sucesso') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast visivel ${tipo}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visivel'), 2600);
  }

  // ---------- utilidades ----------
  const rotulo = { facil: 'Fácil', media: 'Média', dificil: 'Difícil', baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
  const formatarQtd = (n) => {
    if (Math.abs(n - Math.round(n)) < 0.005) return String(Math.round(n));
    return String(Math.round(n * 100) / 100).replace('.', ',');
  };
  const escalarQtd = (qtd, fator) => {
    const s = String(qtd ?? '').trim();
    if (!s) return '';
    const fracao = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fracao) return formatarQtd((Number(fracao[1]) / Number(fracao[2])) * fator);
    const n = parseFloat(s.replace(',', '.'));
    return Number.isNaN(n) ? s : formatarQtd(n * fator);
  };


  // unidades por extenso (sem abreviar), com plural
  function unidadePorExtenso(unidade, qtd) {
    const u = String(unidade || '').toLowerCase().trim();
    const n = Math.abs(Number(String(qtd ?? '').replace(',', '.')) || 1);
    const plural = n > 1;
    const mapa = {
      cs: plural ? 'colheres de sopa' : 'colher de sopa',
      cd: plural ? 'colheres de chá' : 'colher de chá',
      cp: plural ? 'colheres de chá' : 'colher de chá',
      'xíc': plural ? 'xícaras' : 'xícara',
      xic: plural ? 'xícaras' : 'xícara',
      un: '', und: '', unidade: '', unidades: '',
      g: 'g', kg: 'kg', ml: 'ml', l: 'litro' + (plural ? 's' : ''),
    };
    if (u in mapa) return mapa[u];
    return plural && u && !u.endsWith('s') ? u + 's' : u;
  }

  let receita = null;
  let porcoes = 1;
  const checks = new Set();
  const fatorAtual = () => porcoes / (receita?.porcoes || 1);

  // ---------- carregamento ----------
  (async () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { location.href = 'membros.html'; return; }
    try {
      const d = await api(`/api/membros/receitas/${id}`);
      receita = d.receita;
      porcoes = receita.porcoes || 1;
      document.title = `${receita.nome} | Livro de Receitas Digital da Núbia`;
      renderizar();
      carregarRecomendacoes();
    } catch (e) {
      $('#conteudo-receita').innerHTML = `
        <div class="estado-vazio">
          <div class="vazio-icone">🍽</div>
          <h3>Receita não encontrada</h3>
          <p class="cinza">Ela pode ainda não ter sido liberada.</p>
          <a class="btn btn--azul btn--pequeno mt-2" href="membros.html">Ver todas as receitas</a>
        </div>`;
    }
  })();

  // ---------- renderização ----------
  function renderizar() {
    const r = receita;
    $('#conteudo-receita').innerHTML = `
      <img class="foto-receita" src="${r.foto || '/assets/receitas/bowl-frango-quinoa.jpg'}" alt="${r.nome}" />

      <h1 class="titulo-receita">${r.nome}</h1>
      ${r.descricao ? `<p class="subtitulo-receita">${r.descricao}</p>` : ''}
      <div class="tags mt-2">${(r.tags || []).map((t) => `<span class="tag">${t.replace(/-/g, ' ')}</span>`).join('')}</div>

      <div class="nutricao info-receita">
        <div class="nutri"><strong>${r.tempo_preparo_min ?? ''} min</strong><span>preparo</span></div>
        <div class="nutri"><strong>${r.porcoes ?? ''}</strong><span>porção(ões)</span></div>
        <div class="nutri"><strong>${(r.ingredientes || []).length}</strong><span>ingredientes</span></div>
        <div class="nutri"><strong>${(r.passos || []).length}</strong><span>etapas</span></div>
      </div>
      ${(r.dificuldade || r.custo) ? `
      <div class="nutricao mt-1">
        ${r.dificuldade ? `<div class="nutri"><strong>${rotulo[r.dificuldade] || r.dificuldade}</strong><span>dificuldade</span></div>` : ''}
        ${r.custo ? `<div class="nutri"><strong>${rotulo[r.custo] || r.custo}</strong><span>custo estimado</span></div>` : ''}
      </div>` : ''}

      <h2 class="titulo-secao">Informação nutricional (aproximada)</h2>
      ${nutricaoHtml(r)}
      <div class="ingredientes-topo">
        <h2 class="titulo-secao">Ingredientes</h2>
        <div class="porcoes-stepper" aria-label="Ajustar porções">
          <button class="stepper-btn" id="menos-porcao" aria-label="Diminuir porções">−</button>
          <div class="stepper-valor"><strong id="porcoes-qtd">${porcoes}</strong><span>porções</span></div>
          <button class="stepper-btn" id="mais-porcao" aria-label="Aumentar porções">+</button>
        </div>
      </div>
      <ul class="ingredientes ingredientes-check" id="lista-ingredientes"></ul>
      <button class="btn btn--contorno btn--bloco" id="btn-add-lista">🛒 Adicionar ingredientes à lista de compras</button>

      <h2 class="titulo-secao">Modo de preparo <span class="dica-check">toque para marcar o que já foi feito</span></h2>
      <ol class="passos passos-check" id="lista-passos"></ol>

      ${r.dicas ? `<h2 class="titulo-secao">Anote aí</h2><p class="dica-texto">💡 ${r.dicas}</p>` : ''}

      <h2 class="titulo-secao mt-4">Você também vai gostar</h2>
      <div class="receita-grade" id="recomendacoes"></div>
    `;

    renderIngredientes();
    renderPassos();

    $('#menos-porcao').addEventListener('click', () => { if (porcoes > 1) { porcoes--; renderIngredientes(); } });
    $('#mais-porcao').addEventListener('click', () => { if (porcoes < 50) { porcoes++; renderIngredientes(); } });
    $('#btn-add-lista').addEventListener('click', async () => {
      const itens = (r.ingredientes || []).map((i) => {
        const qtd = i.qtd ? escalarQtd(i.qtd, fatorAtual()) : '';
        return { qtd, unidade: unidadePorExtenso(i.unidade, qtd), item: i.item || i.texto || String(i) };
      });
      await post('/api/membros/lista/adicionar', { itens, receita: r.nome });
      toast(`Ingredientes (${porcoes} porção(ões)) na lista de compras! 🛒`);
    });

    // barra de ações fixa
    $('#acoes-receita').classList.remove('oculto');
    $('#acoes-receita').innerHTML = `
      <button class="btn btn--contorno" id="btn-fav">${r.favorito ? '❤️ Favorita' : '🤍 Favoritar'}</button>
      <button class="btn btn--azul" id="btn-feita">${r.feita ? '✓ Já fiz' : '✅ Já fiz essa'}</button>
      <button class="btn btn--cta" id="btn-imprimir">🖨 Imprimir</button>`;
    $('#btn-fav').addEventListener('click', async () => {
      await post(`/api/membros/favoritos/${r.id}`);
      r.favorito = !r.favorito;
      $('#btn-fav').textContent = r.favorito ? '❤️ Favorita' : '🤍 Favoritar';
      toast(r.favorito ? 'Salva nos favoritos ❤️' : 'Removida dos favoritos');
    });
    $('#btn-feita').addEventListener('click', async () => {
      await post(`/api/membros/feitas/${r.id}`);
      r.feita = !r.feita;
      $('#btn-feita').textContent = r.feita ? '✓ Já fiz' : '✅ Já fiz essa';
      toast(r.feita ? 'Receita marcada como feita! 👨‍🍳' : 'Marcação desfeita');
    });
    $('#btn-imprimir').addEventListener('click', () => imprimir());
  }

  function nutricaoHtml(r) {
    const n = r.nutricao_aprox || {};
    return `
      <div class="nutricao">
        <div class="nutri"><strong>🔥 ${n.kcal_por_porcao}</strong><span>kcal/porção</span></div>
        <div class="nutri"><strong>${n.carboidratos_g}g</strong><span>carboidratos</span></div>
        <div class="nutri"><strong>${n.proteinas_g}g</strong><span>proteínas</span></div>
        <div class="nutri"><strong>${n.gorduras_g}g</strong><span>gorduras</span></div>
      </div>
      <p class="pequeno cinza mt-1">≈ Valores <strong>aproximados</strong>, calculados automaticamente a partir dos
      ingredientes e da porção. Podem variar conforme marcas, medidas e modo de preparo.</p>`;
  }

  function renderIngredientes() {
    $('#porcoes-qtd').textContent = porcoes;
    $('#lista-ingredientes').innerHTML = (receita.ingredientes || []).map((i, idx) => {
      // ingrediente normalizado: qtd/unidade/item vêm do servidor; se não houver
      // quantidade reconhecida, exibe o texto original sem escalar
      // itens livres ("Sal a gosto") aparecem exatamente como escritos
      if (i.livre || (!i.qtd && !i.unidade)) {
        return `
      <li class="ing-check ${checks.has(idx) ? 'marcado' : ''}" data-idx="${idx}">
        <span class="check-box">✓</span>
        <span class="ing-texto">${i.texto || i.item || ''}</span>
      </li>`;
      }
      const qtdTxt = escalarQtd(i.qtd || 1, fatorAtual());
      const unTxt = unidadePorExtenso(i.unidade, qtdTxt);
      const juncao = unTxt ? (/^(de|da|do|em)\s/i.test(i.item || '') ? ' ' : ' de ') : ' ';
      const linha = `<strong>${qtdTxt}${unTxt ? ' ' + unTxt : ''}</strong>${juncao}${i.item || ''}`;
      return `
      <li class="ing-check ${checks.has(idx) ? 'marcado' : ''}" data-idx="${idx}">
        <span class="check-box">✓</span>
        <span class="ing-texto">${linha}</span>
      </li>`;}).join('');
    $$('#lista-ingredientes .ing-check').forEach((li) =>
      li.addEventListener('click', () => {
        const idx = Number(li.dataset.idx);
        checks.has(idx) ? checks.delete(idx) : checks.add(idx);
        li.classList.toggle('marcado');
      })
    );
  }

  function renderPassos() {
    $('#lista-passos').innerHTML = (receita.passos || []).map((p, i) => `
      <li class="passo-check" data-idx="${i}">
        <span class="passo-n">${i + 1}</span>
        <span class="passo-texto">${p}</span>
      </li>`).join('');
    $$('#lista-passos .passo-check').forEach((li) =>
      li.addEventListener('click', () => li.classList.toggle('marcado'))
    );
  }

  // ---------- recomendações ----------
  async function carregarRecomendacoes() {
    try {
      const d = await api('/api/membros/receitas');
      const atuais = (receita.tags || []).map((t) => t.toLowerCase());
      const outras = d.receitas
        .filter((x) => x.id !== receita.id)
        .map((x) => ({
          ...x,
          score:
            (x.categoria === receita.categoria ? 2 : 0) +
            (x.tags || []).filter((t) => atuais.includes(t.toLowerCase())).length,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      $('#recomendacoes').innerHTML = outras.map((x) => {
        const n = x.nutricao_aprox || {};
        const kcal = n.kcal_por_porcao && n.total_ingredientes && n.ingredientes_calculados / n.total_ingredientes >= 0.6
          ? n.kcal_por_porcao : null;
        return `
        <a class="receita-card" href="receita.html?id=${x.id}">
          <div class="foto-wrap">
            <img class="foto" src="${x.foto || '/assets/receitas/bowl-frango-quinoa.jpg'}" alt="${x.nome}" />
            <span class="cat-badge">${(x.categoria || '').replace(/-/g, ' ')}</span>
          </div>
          <div class="corpo">
            <h3>${x.nome}</h3>
            <div class="tags-linha">${(x.tags || []).slice(0, 2).map((t) => `<span class="tag">${t.replace(/-/g, ' ')}</span>`).join('')}</div>
            <div class="meta">
              <span class="meta-chip">⏱ ${x.tempo_preparo_min ?? ''} min</span>
              ${kcal ? `<span class="meta-chip kcal">🔥 ~${kcal} kcal</span>` : ''}
            </div>
          </div>
        </a>`;}).join('');
    } catch {}
  }

  // ---------- impressão ----------
  function imprimir() {
    const r = receita;
    $('#area-impressao').innerHTML = `
      <div class="imp-cabecalho">
        <div><h1>${r.nome}</h1><small>${r.descricao || ''}</small></div>
        <div style="text-align:right"><strong>LIVRO DE RECEITAS DA NÚBIA</strong><br><small>⏱ ${r.tempo_preparo_min} min • 🍽 ${Math.round((r.porcoes || 1) * fatorAtual())} porção(ões)</small></div>
      </div>
      <h2>Ingredientes</h2>
      <ul>${(r.ingredientes || []).map((i) => {
        const q = escalarQtd(i.qtd, fatorAtual());
        return `<li>${q} ${unidadePorExtenso(i.unidade, q)} ${i.item || i.texto || i}</li>`;
      }).join('')}</ul>
      <h2>Modo de preparo</h2>
      <ol>${(r.passos || []).map((p) => `<li>${p}</li>`).join('')}</ol>
      ${r.dicas ? `<h2>Anote aí</h2><p>${r.dicas}</p>` : ''}
      <div class="imp-rodape">Conteúdo informativo. Não substitui acompanhamento de nutricionista ou médico. • Livro de Receitas Digital da Núbia</div>`;
    window.print();
  }
})();
