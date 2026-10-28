// Checkout: cria o pedido (Pix, cartão ou boleto), mostra o painel de pagamento
// e, em modo demo, simula a aprovação liberando o acesso + e-mail.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

  let metodo = 'pix';
  let pedidoAtual = null;

  // ---------- Troca de método de pagamento ----------
  $$('.pagamento-opcao').forEach((op) => {
    op.addEventListener('click', () => {
      metodo = op.dataset.metodo;
      $$('.pagamento-opcao').forEach((o) => o.classList.toggle('ativo', o === op));
      op.querySelector('input').checked = true;
      $('#campos-cartao').classList.toggle('oculto', metodo !== 'cartao');
    });
  });

  const mostrarErro = (msg) => {
    const b = $('#erro-checkout');
    b.textContent = msg;
    b.classList.remove('oculto');
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ---------- Criar pedido ----------
  $('#btn-pagar').addEventListener('click', async () => {
    const nome = $('#nome').value.trim();
    const email = $('#email').value.trim();
    if (!nome || !email.includes('@')) return mostrarErro('Preencha seu nome e um e-mail válido para receber o acesso.');
    if (metodo === 'cartao') {
      const num = $('#cartao-numero').value.replace(/\s/g, '');
      if (num.length < 12 || !$('#cartao-validade').value || !$('#cartao-cvv').value) {
        return mostrarErro('Preencha os dados do cartão para continuar.');
      }
    }

    const btn = $('#btn-pagar');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
      const r = await fetch('/api/checkout/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, metodo,
          utm: window.OFTrack?.utm || null,
          sessao: window.OFTrack?.sessao || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não foi possível iniciar o pagamento');

      pedidoAtual = d.pedido;
      window.OFTrack?.enviar('checkout_criado', { pedidoId: d.pedido.id, valor: d.pedido.valor });
      renderizarPagamento(d);
    } catch (e) {
      mostrarErro(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = `Finalizar compra — ${fmt(19.9)}`;
    }
  });

  // ---------- Painel de pagamento ----------
  function renderizarPagamento(d) {
    const painel = $('#painel-pagamento');
    painel.classList.remove('oculto');
    $('#demo-aviso').style.display = d.demo ? 'block' : 'none';

    if (metodo === 'pix') {
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">⚡ Pague com Pix</h3>
        <div class="pix-caixa">
          <div class="qr-demo" aria-label="QR Code Pix (demonstração)"></div>
          <p class="pequeno cinza texto-centro">Escaneie o QR Code acima no app do seu banco</p>
          <div class="pix-codigo">${d.pix.copiaECola}</div>
          <button class="btn btn--contorno btn--pequeno btn--bloco" id="btn-copiar">📋 Copiar código Pix</button>
        </div>
        ${botoesDemo(d)}`;
    } else if (metodo === 'cartao') {
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">💳 Cartão de crédito</h3>
        <p class="pequeno cinza">Valor: ${fmt(d.pedido.valor)} • até 2x sem juros</p>
        ${botoesDemo(d)}`;
    } else {
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">📄 Boleto bancário</h3>
        <div class="pix-caixa">
          <p class="pequeno cinza">Linha digitável:</p>
          <div class="pix-codigo">${d.boleto.linhaDigitavel}</div>
          <button class="btn btn--contorno btn--pequeno btn--bloco" id="btn-copiar">📋 Copiar linha digitável</button>
          <p class="pequeno cinza mt-1">O acesso é liberado após a compensação (até 2 dias úteis).</p>
        </div>
        ${botoesDemo(d)}`;
    }

    painel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    $('#btn-copiar')?.addEventListener('click', (e) => {
      const texto = metodo === 'pix' ? d.pix.copiaECola : d.boleto.linhaDigitavel;
      navigator.clipboard?.writeText(texto);
      e.target.textContent = '✓ Copiado!';
    });

    $('#btn-demo-aprovar')?.addEventListener('click', () => aprovarDemo(d));
  }

  const botoesDemo = (d) =>
    d.demo
      ? `<button class="btn btn--azul btn--bloco mt-2" id="btn-demo-aprovar">✓ Simular pagamento aprovado (demo)</button>
         <p class="pequeno cinza texto-centro mt-1">Em produção, o acesso é liberado automaticamente pelo webhook do gateway.</p>`
      : `<p class="pequeno cinza texto-centro mt-2">Aguardando confirmação do pagamento... esta página atualiza sozinha.</p>
         <script>window.setInterval(async () => {
           const r = await fetch('/api/checkout/pedidos/${d.pedido.id}');
           const j = await r.json();
           if (j.pedido?.status === 'pago') location.href = '/obrigado.html?pedido=${d.pedido.id}';
         }, 5000);<\/script>`;

  async function aprovarDemo(d) {
    try {
      const r = await fetch(`/api/checkout/pedidos/${d.pedido.id}/aprovar`, { method: 'POST' });
      const j = await r.json();
      if (j.url) {
        window.OFTrack?.enviar('purchase', { pedidoId: d.pedido.id, valor: d.pedido.valor });
        location.href = j.url;
      }
    } catch {
      mostrarErro('Não foi possível confirmar o pagamento. Tente novamente.');
    }
  }

  // Pré-preenche o e-mail se já veio na URL (ex.: ?email=)
  const q = new URLSearchParams(location.search);
  if (q.get('email')) $('#email').value = q.get('email');
  if (q.get('nome')) $('#nome').value = q.get('nome');
})();
