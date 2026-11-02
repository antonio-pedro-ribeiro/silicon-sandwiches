// Interface web: só fala com o servidor pela API HTTP (os mesmos pedidos do README).
// Os tipos abaixo descrevem o JSON que a API devolve; o servidor tira-os antes de enviar este ficheiro.
interface Store { id: string; name: string; city: string; open: boolean }
interface MenuItem { id: string; name: string; priceCents: number }
interface CartLine { id: string; name: string; quantity: number }
interface Recipe { ingredients: { ingredient: string; quantity: number; unit: string }[] }
interface Order {
  id: number;
  lines: { name: string; quantity: number; unitPriceCents: number }[];
  promoCode: string | null;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentRef: string;
}
interface Ticket { id: number; orderId: number; storeId: string; status: string; items: { name: string; quantity: number }[] }
interface Delivery { id: number; orderId: number; address: string; status: string; etaMinutes: number }
interface StockReport { items: { ingredient: string; quantity: number }[] }
interface Promotion { code: string; description: string }
interface Health { style: string; modules: string[]; remote?: Record<string, string> }
type ApiError = Error & { status?: number };

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const euros = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const escape = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const EMOJI: Record<string, string> = { 'tosta-mista': '🥪', bifana: '🥩', prego: '🥖', 'wrap-vegan': '🌯', francesinha: '🧀' };

// O carrinho guarda só id, nome e quantidade: o preço vem sempre do menu da loja escolhida.
const state = {
  stores: [] as Store[],
  store: null as Store | null,
  menu: [] as MenuItem[],
  cart: new Map<string, CartLine>(),
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  logHttp(method, path, res.status);
  if (!res.ok) throw Object.assign(new Error(data?.error ?? res.statusText), { status: res.status });
  return data as T;
}

function logHttp(method: string, path: string, status: number): void {
  const li = document.createElement('li');
  li.innerHTML = `<span class="status s${String(status)[0]}">${status}</span>${method} ${escape(path)}`;
  $('#http-log').prepend(li);
  while ($('#http-log').children.length > 15) $('#http-log').lastChild!.remove();
}

// --- Arquitetura (vinda de /health) ---------------------------------------------------------

async function loadArchitecture(): Promise<void> {
  const health = await api<Health>('GET', '/health');
  document.body.dataset.style = 'deployment';
  $('#style-badge').textContent = '📦 Modular · 2 deployments';

  const chips = health.modules.map((p) => `<span class="chip real">${p}</span>`);
  const remote = Object.entries(health.remote ?? {})
    .map(([name, url]) => `<span class="chip remote" title="${escape(url)}">${name} ↗</span>`);
  $('#architecture').innerHTML =
    `<span class="label">Este processo:</span>${chips.join('')}` +
    `<span class="label">Noutro processo:</span>${remote.join('')}` +
    '<span class="muted">· cada pacote com a sua base de dados</span>';
}

// --- Lojas e menu ---------------------------------------------------------------------------

async function loadStores(): Promise<void> {
  state.stores = await api<Store[]>('GET', '/stores');
  renderStores();
}

function renderStores(): void {
  $('#stores').innerHTML = state.stores.map((s) => `
    <button class="store ${s.open ? '' : 'closed'} ${state.store?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
      <strong>${escape(s.name)}</strong>
      <small>${escape(s.city)}</small><br>
      <span class="pill ${s.open ? 'open' : 'closed'}">${s.open ? 'aberta' : 'fechada'}</span>
    </button>`).join('');
}

async function selectStore(id: string): Promise<void> {
  const store = state.stores.find((s) => s.id === id);
  if (!store) return;
  state.store = store;
  renderStores();
  $('#menu-store').textContent = `· ${store.name}`;
  state.menu = await api<MenuItem[]>('GET', `/stores/${encodeURIComponent(id)}/menu`);
  renderMenu();
  renderCart();
  loadStock();
}

function renderMenu(): void {
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

async function showRecipe(id: string): Promise<void> {
  const box = document.getElementById(`recipe-${id}`)!;
  try {
    const recipe = await api<Recipe>('GET', `/recipes/${encodeURIComponent(id)}`);
    box.textContent = recipe.ingredients.map((i) => `${i.quantity} ${i.unit} ${i.ingredient}`).join(', ');
  } catch {
    box.textContent = 'Receita indisponível.';
  }
}

// --- Carrinho ---------------------------------------------------------------------------------

function addToCart(id: string): void {
  const item = state.menu.find((m) => m.id === id);
  if (!item) return;
  const line = state.cart.get(id) ?? { id, name: item.name, quantity: 0 };
  line.quantity += 1;
  state.cart.set(id, line);
  renderCart();
}

function changeQty(id: string, delta: number): void {
  const line = state.cart.get(id);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) state.cart.delete(id);
  renderCart();
}

function renderCart(): void {
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
  $<HTMLButtonElement>('#submit').disabled = !state.store || state.cart.size === 0;
}

// --- Checkout ---------------------------------------------------------------------------------

async function submitCheckout(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!state.store) return;
  const fulfilment = document.querySelector<HTMLInputElement>('input[name="fulfilment"]:checked')!.value;
  const request = {
    storeId: state.store.id,
    customerId: $<HTMLInputElement>('#customer').value.trim(),
    items: [...state.cart.values()].map(({ id, quantity }) => ({ sandwichId: id, quantity })),
    promoCode: $<HTMLInputElement>('#promo').value.trim() || undefined,
    fulfilment,
    address: fulfilment === 'delivery' ? $<HTMLInputElement>('#address').value.trim() : undefined,
  };

  $<HTMLButtonElement>('#submit').disabled = true;
  try {
    const order = await api<Order>('POST', '/checkout', request);
    showReceipt(order);
    state.cart.clear();
    renderCart();
  } catch (err) {
    const { status, message } = err as ApiError;
    $('#result').innerHTML = `
      <div class="result err">
        <h3>✘ Encomenda recusada <span class="mono">HTTP ${status ?? '?'}</span></h3>
        ${escape(message)}
      </div>`;
    $<HTMLButtonElement>('#submit').disabled = false;
  }
  loadBackstage();
}

function showReceipt(o: Order): void {
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

async function loadBackstage(): Promise<void> {
  // Se o serviço Delivery estiver desligado, a cozinha continua a aparecer.
  const [queue, deliveries] = await Promise.all([
    api<Ticket[]>('GET', '/kitchen/queue'),
    api<Delivery[]>('GET', '/deliveries').catch((err: ApiError) => err),
  ]);
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
  $('#deliveries').innerHTML = deliveries instanceof Error
    ? `<li class="muted">Serviço Delivery indisponível (${deliveries.status}): ${escape(deliveries.message)}</li>`
    : deliveries.map((d) => `
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

async function loadStock(): Promise<void> {
  if (!state.store) return;
  const { items } = await api<StockReport>('GET', `/inventory/${encodeURIComponent(state.store.id)}`);
  $('#stock-store').textContent = `· ${state.store.city}`;
  const max = Math.max(40, ...items.map((i) => i.quantity));
  $('#stock').innerHTML = items.map((i) => `
    <li class="${i.quantity < 10 ? 'low' : ''}">
      <span>${escape(i.ingredient)}</span><strong>${i.quantity}</strong>
      <span class="bar"><span style="width:${(100 * i.quantity) / max}%"></span></span>
    </li>`).join('') || '<li class="muted">Sem stock.</li>';
}

async function advance(path: string): Promise<void> {
  try {
    await api('POST', path);
  } finally {
    loadBackstage();
  }
}

async function loadPromotions(): Promise<void> {
  const promos = await api<Promotion[]>('GET', '/promotions');
  $('#promo-chips').innerHTML = promos.map((p) =>
    `<button type="button" class="promo-chip" data-promo="${escape(p.code)}" title="${escape(p.description)}">${escape(p.code)}</button>`)
    .join('');
}

// --- Eventos ----------------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const t = (e.target as Element).closest('button');
  if (!t) return;
  const { id, add, qty, delta, recipe, advance: path, promo } = t.dataset;
  if (t.classList.contains('store')) selectStore(id!);
  else if (add) addToCart(add);
  else if (qty) changeQty(qty, Number(delta));
  else if (recipe) showRecipe(recipe);
  else if (path) advance(path);
  else if (promo) $<HTMLInputElement>('#promo').value = promo;
});

document.querySelectorAll<HTMLInputElement>('input[name="fulfilment"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    const delivery = radio.value === 'delivery' && radio.checked;
    $('#address-field').hidden = !delivery;
    $<HTMLInputElement>('#address').required = delivery;
  }));

$<HTMLFormElement>('#checkout-form').addEventListener('submit', submitCheckout);

renderCart();
await Promise.all([loadArchitecture(), loadStores(), loadPromotions(), loadBackstage()]);
