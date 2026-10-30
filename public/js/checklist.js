// Checklist de despensa: lista-base com marcação salva no aparelho,
// progresso, envio pelo WhatsApp e impressão.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // escape obrigatório para qualquer texto que entra em HTML (XSS)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


  const GRUPOS = [
    { nome: '🌾 Grãos e cereais', itens: ['Arroz', 'Feijão (ou lentilha)', 'Aveia em flocos', 'Farinha de trigo', 'Macarrão', 'Tapioca (goma ou granulada)', 'Cuscuz'] },
    { nome: '🥚 Proteínas', itens: ['Ovos', 'Peito de frango', 'Carne moída', 'Patinho ou coxa e sobrecoxa', 'Atum e sardinha em conserva', 'Queijo minas', 'Ricota', 'Iogurte natural'] },
    { nome: '🥬 Hortifrúti', itens: ['Batata', 'Batata-doce', 'Cebola', 'Alho', 'Tomate', 'Cenoura', 'Abobrinha', 'Banana', 'Limão', 'Frutas da estação'] },
    { nome: '🧂 Temperos e condimentos', itens: ['Sal', 'Pimenta-do-reino', 'Orégano', 'Páprica', 'Cúrcuma', 'Alho em pó', 'Azeite', 'Vinagre', 'Shoyu ou tamari', 'Mostarda', 'Maionese'] },
    { nome: '🥫 Despensa básica', itens: ['Óleo', 'Açúcar ou adoçante', 'Café', 'Chá', 'Fermento em pó', 'Bicarbonato', 'Caldo de legumes em pó', 'Leite (ou leite vegetal)'] },
    { nome: '❄️ Congelados úteis', itens: ['Legumes congelados', 'Frango desfiado congelado', 'Hambúrgueres caseiros', 'Frutas congeladas para smoothie'] },
  ];

  const CHAVE = 'of_checklist_despensa';
  const estado = () => JSON.parse(localStorage.getItem(CHAVE) || '{}');
  const salvar = (e) => localStorage.setItem(CHAVE, JSON.stringify(e));

  let toastTimer;
  function toast(msg, tipo = 'sucesso') {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast visivel ${tipo}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visivel'), 2600);
  }

  function renderizar() {
    const e = estado();
    $('#checklist').innerHTML = GRUPOS.map((g) => `
      <div class="check-grupo">
        <h3>${g.nome}</h3>
        ${g.itens.map((item) => `
          <label class="pp-item check-item">
            <input type="checkbox" data-item="${item}" ${e[item] ? 'checked' : ''} />
            <span>${item}</span>
          </label>`).join('')}
      </div>`).join('');

    $$('#checklist input[data-item]').forEach((c) => {
      c.addEventListener('change', () => {
        const st = estado();
        st[c.dataset.item] = c.checked;
        salvar(st);
        atualizarProgresso();
      });
    });
    atualizarProgresso();
  }

  function atualizarProgresso() {
    const e = estado();
    const todos = GRUPOS.flatMap((g) => g.itens);
    const marcados = todos.filter((i) => e[i]).length;
    const pct = todos.length ? Math.round((marcados / todos.length) * 100) : 0;
    $('#progresso-texto').textContent = `${marcados} de ${todos.length} itens`;
    $('#progresso-pct').textContent = `${pct}%`;
    $('#progresso-barra').style.width = `${pct}%`;
  }

  $('#btn-limpar').addEventListener('click', () => {
    if (!confirm('Limpar todas as marcações?')) return;
    salvar({});
    renderizar();
    toast('Marcações limpas');
  });

  $('#btn-whatsapp').addEventListener('click', () => {
    const e = estado();
    const porGrupo = GRUPOS.map((g) => {
      const linhas = g.itens.map((i) => `${e[i] ? '✅' : '⬜'} ${i}`);
      return `*${g.nome}*\n${linhas.join('\n')}`;
    }).join('\n\n');
    const texto = `🧺 *Checklist de despensa | OfertaFitBR*\n\n${porGrupo}\n\n🥗 Feita na área de membros`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  });

  $('#btn-imprimir').addEventListener('click', () => window.print());

  renderizar();
})();
