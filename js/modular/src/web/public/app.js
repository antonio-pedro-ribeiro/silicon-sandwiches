// Interface web: só fala com o servidor pela API HTTP (os mesmos pedidos do README).
const $ = (sel) => document.querySelector(sel);
const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const EMOJI = { 'tosta-mista': '🥪', bifana: '🥩', prego: '🥖', 'wrap-vegan': '🌯', francesinha: '🧀' };

// O carrinho guarda só id, nome e quantidade: o preço vem sempre do menu da loja escolhida.
const state = { stores: [], store: null, menu: [], cart: new Map() };

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  logHttp(method, path, res.status);
  if (!res.ok) throw Object.assign(new Error(data?.error ?? res.statusText), { status: res.status });
  return data;
}

function logHttp(method, path, status) {
  const li = document.createElement('li');
  li.innerHTML = `<span class="status s${String(status)[0]}">${status}</span>${method} ${escape(path)}`;
  $('#http-log').prepend(li);
  while ($('#http-log').children.length > 15) $('#http-log').lastChild.remove();
}

// --- Arquitetura (vinda de /health) ---------------------------------------------------------

async function loadArchitecture() {
  const health = await api('GET', '/health');
  const modular = health.style !== 'layered';
  document.body.dataset.style = modular ? 'modular' : 'layered';
  $('#style-badge').textContent = modular ? '🧩 Modular Monolith' : '🧱 Layered';

  const parts = modular ? health.modules : health.layers;
  const chips = parts.map((p) => `<span class="chip real">${p}</span>`);
  $('#architecture').innerHTML = modular
    ? `<span class="label">Módulos:</span>${chips.join('')}<span class="muted">· cada um com as suas tabelas e a sua API</span>`
    : `<span class="label">Camadas:</span>${chips.join('<span class="arrow">→</span>')}<span class="muted">· cada pedido atravessa todas</span>`;
}

// --- Lojas e menu ---------------------------------------------------------------------------

async function loadStores() {
  state.stores = await api('GET', '/stores');
  renderStores();
}

function renderStores() {
  $('#stores').innerHTML = state.stores.map((s) => `
    <button class="store ${s.open ? '' : 'closed'} ${state.store?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
      <strong>${escape(s.name)}</strong>
      <small>${escape(s.city)}</small><br>
      <span class="pill ${s.open ? 'open' : 'closed'}">${s.open ? 'aberta' : 'fechada'}</span>
    </button>`).join('');
}

async function selectStore(id) {
  state.store = state.stores.find((s) => s.id === id);
  renderStores();
  $('#menu-store').textContent = `· ${state.store.name}`;
  state.menu = await api('GET', `/stores/${encodeURIComponent(id)}/menu`);
  renderMenu();
  renderCart();
  loadStock();
}

function renderMenu() {
  $('#menu').innerHTML = state.menu.map((item) => `
    <div class="item">
      <span class="emoji">${EMOJI[item.id] ?? '🥪'}</span>
      <strong>${escape(item.name)}</strong>
      <div class="recipe" id="recipe-${item.id}">
        <button class="link" data-recipe="${item.id}">ver ingredientes</button>
      </div>
      <div class="row">
        <span class="price">${euros(item.priceCents)}</span>
        <button class="add" data-add="${item.id}">+ Adicionar</button>
      </div>
    </div>`).join('');
}

async function showRecipe(id) {
  const box = document.getElementById(`recipe-${id}`);
  try {
    const recipe = await api('GET', `/recipes/${encodeURIComponent(id)}`);
    box.textContent = recipe.ingredients.map((i) => `${i.quantity} ${i.unit} ${i.ingredient}`).join(', ');
  } catch {
    box.textContent = 'Receita indisponível.';
  }
}

// --- Carrinho ---------------------------------------------------------------------------------

function addToCart(id) {
  const item = state.menu.find((m) => m.id === id);
  const line = state.cart.get(id) ?? { id, name: item.name, quantity: 0 };
  line.quantity += 1;
  state.cart.set(id, line);
  renderCart();
}

function changeQty(id, delta) {
  const line = state.cart.get(id);
  line.quantity += delta;
  if (line.quantity <= 0) state.cart.delete(id);
  renderCart();
}

function renderCart() {
  const prices = new Map(state.menu.map((m) => [m.id, m.priceCents]));
  let subtotal = 0;
  $('#cart-lines').innerHTML = [...state.cart.values()].map((line) => {
    const price = prices.get(line.id);
    if (price !== undefined) subtotal += price * line.quantity;
    return `
      <li>
        <span>${EMOJI[line.id] ?? '🥪'} ${escape(line.name)}</span>
        <span class="qtys">
          <button class="qty" data-qty="${line.id}" data-delta="-1">−</button>
          ${line.quantity}
          <button class="qty" data-qty="${line.id}" data-delta="1">+</button>
        </span>
        ${price === undefined
          ? '<span class="warn">⚠ não existe no menu desta loja (o servidor vai recusar)</span>'
          : `<span class="muted">${euros(price)} cada</span>`}
      </li>`;
  }).join('') || '<li class="muted">O carrinho está vazio.</li>';
  $('#cart-subtotal').textContent = euros(subtotal);
  $('#submit').disabled = !state.store || state.cart.size === 0;
}

// --- Checkout ---------------------------------------------------------------------------------

async function submitCheckout(event) {
  event.preventDefault();
  const fulfilment = document.querySelector('input[name="fulfilment"]:checked').value;
  const request = {
    storeId: state.store.id,
    customerId: $('#customer').value.trim(),
    items: [...state.cart.values()].map(({ id, quantity }) => ({ sandwichId: id, quantity })),
    promoCode: $('#promo').value.trim() || undefined,
    fulfilment,
    address: fulfilment === 'delivery' ? $('#address').value.trim() : undefined,
  };

  $('#submit').disabled = true;
  try {
    const order = await api('POST', '/checkout', request);
    showReceipt(order);
    state.cart.clear();
    renderCart();
  } catch (err) {
    $('#result').innerHTML = `
      <div class="result err">
        <h3>✘ Encomenda recusada <span class="mono">HTTP ${err.status ?? '?'}</span></h3>
        ${escape(err.message)}
      </div>`;
    $('#submit').disabled = false;
  }
  loadBackstage();
}

function showReceipt(o) {
  const lines = o.lines.map((l) =>
    `<tr><td>${l.quantity}× ${escape(l.name)}</td><td>${euros(l.quantity * l.unitPriceCents)}</td></tr>`).join('');
  $('#result').innerHTML = `
    <div class="result ok">
      <h3>✔ Encomenda #${o.id} confirmada</h3>
      <table class="receipt">
        ${lines}
        <tr><td>Desconto ${o.promoCode ? `(${escape(o.promoCode)})` : ''}</td><td>− ${euros(o.discountCents)}</td></tr>
        <tr><td>Entrega</td><td>${euros(o.deliveryFeeCents)}</td></tr>
        <tr class="total"><td>Total</td><td>${euros(o.totalCents)}</td></tr>
      </table>
      <p class="muted">Pagamento ${escape(o.paymentRef)} · <a href="/orders/${o.id}" target="_blank">ver JSON</a></p>
    </div>`;
}

// --- Bastidores -------------------------------------------------------------------------------

const KITCHEN_DONE = 'COLLECTED';
const DELIVERY_DONE = 'DELIVERED';

async function loadBackstage() {
  const [queue, deliveries] = await Promise.all([api('GET', '/kitchen/queue'), api('GET', '/deliveries')]);
  $('#kitchen').innerHTML = queue.map((t) => `
    <li>
      <div class="row">
        <span><strong>Encomenda #${t.orderId}</strong> · ${escape(t.storeId)}</span>
        <span class="state ${t.status === KITCHEN_DONE ? 'done' : ''}">${t.status}</span>
      </div>
      <div class="row">
        <span>${t.items.map((i) => `${i.quantity}× ${escape(i.name)}`).join(', ')}</span>
        ${t.status === KITCHEN_DONE ? '' : `<button class="advance" data-advance="/kitchen/tickets/${t.id}/advance">avançar ›</button>`}
      </div>
    </li>`).join('') || '<li class="muted">Sem encomendas.</li>';
  $('#deliveries').innerHTML = deliveries.map((d) => `
    <li>
      <div class="row">
        <span><strong>Encomenda #${d.orderId}</strong> · ETA ${d.etaMinutes} min</span>
        <span class="state ${d.status === DELIVERY_DONE ? 'done' : ''}">${d.status}</span>
      </div>
      <div class="row">
        <span>→ ${escape(d.address)}</span>
        ${d.status === DELIVERY_DONE ? '' : `<button class="advance" data-advance="/deliveries/${d.id}/advance">avançar ›</button>`}
      </div>
    </li>`).join('') || '<li class="muted">Sem entregas.</li>';
  loadStock();
}

async function loadStock() {
  if (!state.store) return;
  const { items } = await api('GET', `/inventory/${encodeURIComponent(state.store.id)}`);
  $('#stock-store').textContent = `· ${state.store.city}`;
  const max = Math.max(40, ...items.map((i) => i.quantity));
  $('#stock').innerHTML = items.map((i) => `
    <li class="${i.quantity < 10 ? 'low' : ''}">
      <span>${escape(i.ingredient)}</span><strong>${i.quantity}</strong>
      <span class="bar"><span style="width:${(100 * i.quantity) / max}%"></span></span>
    </li>`).join('') || '<li class="muted">Sem stock.</li>';
}

async function advance(path) {
  try {
    await api('POST', path);
  } finally {
    loadBackstage();
  }
}

async function loadPromotions() {
  const promos = await api('GET', '/promotions');
  $('#promo-chips').innerHTML = promos.map((p) =>
    `<button type="button" class="promo-chip" data-promo="${escape(p.code)}" title="${escape(p.description)}">${escape(p.code)}</button>`)
    .join('');
}

// --- Eventos ----------------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.classList.contains('store')) selectStore(t.dataset.id);
  else if (t.dataset.add) addToCart(t.dataset.add);
  else if (t.dataset.qty) changeQty(t.dataset.qty, Number(t.dataset.delta));
  else if (t.dataset.recipe) showRecipe(t.dataset.recipe);
  else if (t.dataset.advance) advance(t.dataset.advance);
  else if (t.dataset.promo) $('#promo').value = t.dataset.promo;
});

document.querySelectorAll('input[name="fulfilment"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    const delivery = radio.value === 'delivery' && radio.checked;
    $('#address-field').hidden = !delivery;
    $('#address').required = delivery;
  }));

$('#checkout-form').addEventListener('submit', submitCheckout);

renderCart();
await Promise.all([loadArchitecture(), loadStores(), loadPromotions(), loadBackstage()]);
