// Checkout: Pix, cartão e boleto.
// PRODUÇÃO: Orders API do Mercado Pago (tokenização do cartão via SDK oficial).
// MODO DEMO: sem MP_ACCESS_TOKEN — simula o pagamento para testes.
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

  let metodo = 'pix';
  let pedidoAtual = null;
  let config = { mp_ativo: false, mp_public_key: null };
  let cardForm = null;
  let pollTimer = null;

  // ---------- Configuração (public key + modo) ----------
  fetch('/api/produto').then((r) => r.json()).then((p) => {
    config = p;
    if (p.mp_ativo && p.mp_public_key) prepararSDK();
  }).catch(() => {});

  function prepararSDK() {
    if (window.MercadoPago) return;
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload = () => montarCardForm();
    document.head.appendChild(s);
  }

  function montarCardForm() {
    if (cardForm || !window.MercadoPago) return;
    const mp = new MercadoPago(config.mp_public_key, { locale: 'pt-BR' });
    cardForm = mp.cardForm({
      amount: String(config.preco ?? 19.9),
      autoMount: true,
      form: {
        id: 'form-pagamento',
        cardholderName: { id: 'form-checkout__cardholderName' },
        cardNumber: { id: 'form-checkout__cardNumber' },
        expirationDate: { id: 'form-checkout__expirationDate' },
        securityCode: { id: 'form-checkout__securityCode' },
        installments: { id: 'form-checkout__installments' },
        identificationType: { id: 'form-checkout__identificationType' },
        identificationNumber: { id: 'form-checkout__identificationNumber' },
        issuer: { id: 'form-checkout__issuer' },
      },
      callbacks: {
        onFormMounted: (e) => { if (e) console.warn('[MP] form:', e); },
        onInstallmentsReceived: () => $('#campo-parcelas-wrap')?.classList.remove('oculto'),
        onError: (e) => console.warn('[MP]', e),
      },
    });
  }

  // ---------- Troca de método ----------
  $$('.pagamento-opcao').forEach((op) => {
    op.addEventListener('click', () => {
      metodo = op.dataset.metodo;
      $$('.pagamento-opcao').forEach((o) => o.classList.toggle('ativo', o === op));
      op.querySelector('input').checked = true;
      $('#campos-cartao').classList.toggle('oculto', metodo !== 'cartao');
      $('#campos-boleto').classList.toggle('oculto', metodo !== 'boleto');
      if (metodo === 'cartao' && config.mp_ativo) prepararSDK();
    });
  });

  const mostrarErro = (msg) => {
    const b = $('#erro-checkout');
    b.textContent = msg;
    b.classList.remove('oculto');
    b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ---------- Dados do formulário ----------
  function dadosCartao() {
    if (!cardForm) return null;
    try {
      const d = cardForm.getCardFormData();
      return {
        token: d.token,
        bandeira: d.paymentMethodId,
        parcelas: Number(d.installments) || 1,
        tipoDoc: d.identificationType,
        documento: d.identificationNumber,
      };
    } catch {
      return null;
    }
  }

  // ---------- Finalizar compra ----------
  $('#btn-pagar').addEventListener('click', async () => {
    const nome = $('#nome').value.trim();
    const email = $('#email').value.trim();
    if (!nome || !email.includes('@')) return mostrarErro('Preencha seu nome e um e-mail válido para receber o acesso.');

    let cartao = null;
    if (metodo === 'cartao') {
      if (config.mp_ativo) {
        cartao = dadosCartao();
        if (!cartao?.token) return mostrarErro('Confira os dados do cartão para continuar.');
      } else {
        // modo demo: só valida os campos visíveis
        const num = $('#form-checkout__cardNumber').value.replace(/\s/g, '');
        if (num.length < 12 || !$('#form-checkout__expirationDate').value || !$('#form-checkout__securityCode').value) {
          return mostrarErro('Preencha os dados do cartão para continuar.');
        }
      }
    }

    const corpo = {
      nome, email, metodo,
      utm: window.OFTrack?.utm || null,
      sessao: window.OFTrack?.sessao || null,
    };

    if (metodo === 'cartao' && cartao) {
      corpo.cartao = cartao;
      corpo.documento = cartao.documento;
    }
    if (metodo === 'boleto') {
      corpo.documento = $('#boleto-cpf').value;
      corpo.cep = $('#boleto-cep').value;
      corpo.rua = $('#boleto-rua').value;
      corpo.numero = $('#boleto-numero').value;
      corpo.bairro = $('#boleto-bairro').value;
      corpo.cidade = $('#boleto-cidade').value;
      corpo.uf = $('#boleto-uf').value.toUpperCase();
      if (!corpo.documento || !corpo.rua || !corpo.cep || !corpo.bairro) {
        return mostrarErro('Para emitir o boleto, preencha CPF, CEP, endereço e bairro.');
      }
    }

    const btn = $('#btn-pagar');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    try {
      const r = await fetch('/api/checkout/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
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
      btn.textContent = `Finalizar compra — ${fmt(config.preco ?? 19.9)}`;
    }
  });

  // ---------- Painel de pagamento ----------
  function renderizarPagamento(d) {
    const painel = $('#painel-pagamento');
    painel.classList.remove('oculto');
    $('#demo-aviso').style.display = d.demo ? 'block' : 'none';

    if (metodo === 'pix') {
      const qr = d.pix?.qrBase64
        ? `<img alt="QR Code Pix" style="width:200px;height:200px;margin:0 auto;display:block;border-radius:14px" src="data:image/png;base64,${d.pix.qrBase64}" />`
        : '<div class="qr-demo" aria-label="QR Code Pix (demonstração)"></div>';
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">⚡ Pague com Pix</h3>
        <div class="pix-caixa">
          ${qr}
          <p class="pequeno cinza texto-centro">Escaneie o QR Code acima no app do seu banco</p>
          <div class="pix-codigo">${d.pix?.copiaECola || ''}</div>
          <button class="btn btn--contorno btn--pequeno btn--bloco" id="btn-copiar">📋 Copiar código Pix</button>
          ${d.pix?.link ? `<a class="btn btn--azul btn--pequeno btn--bloco mt-2" href="${d.pix.link}" target="_blank">Abrir no app do Mercado Pago</a>` : ''}
        </div>
        ${botoesDemo(d)}`;
    } else if (metodo === 'cartao') {
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">💳 Cartão de crédito</h3>
        <p class="pequeno cinza">${d.cartao?.detalhe ? `Situação: ${d.cartao.detalhe}` : `Valor: ${fmt(d.pedido.valor)} • até 2x sem juros`}</p>
        ${botoesDemo(d)}`;
    } else {
      painel.innerHTML = `
        <h3 style="font-size:1.02rem">📄 Boleto bancário</h3>
        <div class="pix-caixa">
          ${d.boleto?.link
            ? `<a class="btn btn--azul btn--bloco" href="${d.boleto.link}" target="_blank">Abrir boleto</a>`
            : ''}
          ${d.boleto?.linhaDigitavel ? `<p class="pequeno cinza mt-2">Linha digitável:</p><div class="pix-codigo">${d.boleto.linhaDigitavel}</div>` : ''}
          <button class="btn btn--contorno btn--pequeno btn--bloco" id="btn-copiar">📋 Copiar linha digitável</button>
          <p class="pequeno cinza mt-1">O acesso é liberado após a compensação (até 2 dias úteis).</p>
        </div>
        ${botoesDemo(d)}`;
    }

    painel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    $('#btn-copiar')?.addEventListener('click', (e) => {
      const texto = metodo === 'pix' ? d.pix?.copiaECola : d.boleto?.linhaDigitavel;
      navigator.clipboard?.writeText(texto || '');
      e.target.textContent = '✓ Copiado!';
    });

    $('#btn-demo-aprovar')?.addEventListener('click', () => aprovarDemo(d));

    // produção: confirma o pagamento consultando o status do pedido
    if (!d.demo) iniciarPolling(d.pedido.id);
  }

  const botoesDemo = (d) =>
    d.demo
      ? `<button class="btn btn--azul btn--bloco mt-2" id="btn-demo-aprovar">✓ Simular pagamento aprovado (demo)</button>
         <p class="pequeno cinza texto-centro mt-1">Em produção, o acesso é liberado automaticamente pelo webhook do gateway.</p>`
      : `<p class="pequeno cinza texto-centro mt-2">⏳ Aguardando a confirmação do pagamento... esta página atualiza sozinha.</p>`;

  function iniciarPolling(pedidoId) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const r = await fetch(`/api/checkout/pedidos/${pedidoId}`);
        const j = await r.json();
        if (j.pedido?.status === 'pago') {
          clearInterval(pollTimer);
          window.OFTrack?.enviar('purchase', { pedidoId, valor: j.pedido.valor });
          location.href = `/obrigado.html?pedido=${pedidoId}`;
        }
      } catch {}
    }, 5000);
  }

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

  // Pré-preenche vindo da URL
  const q = new URLSearchParams(location.search);
  if (q.get('email')) $('#email').value = q.get('email');
  if (q.get('nome')) $('#nome').value = q.get('nome');
})();
