// Silicon Sandwiches · Big Ball of Mud
//
// A aplicação inteira numa só classe: servidor HTTP, router, HTML, CSS, o JavaScript que corre no browser,
// regras de negócio, SQL, esquema da base de dados, dados de exemplo, demo e limpeza da base de dados.
// Funciona exatamente como as versões layered/ e modular/ (os testes são os mesmos), mas não tem estrutura.
//
// Os comentários "LAMA:" assinalam os anti-padrões, para se encontrarem durante a aula.
// Não copiar para nenhum projeto a sério.
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export default class SiliconSandwiches {
  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath;
    if (dbPath != ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);

    // LAMA: o esquema é criado no construtor, com o SQL escrito mais abaixo nesta mesma classe.
    const v = this.db.prepare('PRAGMA user_version').get().user_version;
    if (v != 1) {
      const t = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
      if (t.length) console.log('Esquema da base de dados desatualizado: a recriar com os dados de exemplo.');
      for (const x of t) this.db.exec('DROP TABLE "' + x.name + '"');
      this.db.exec('PRAGMA user_version = 1');
    }
    this.db.exec(SiliconSandwiches.SCHEMA);
    if (this.db.prepare('SELECT COUNT(*) AS n FROM store').get().n == 0) this.db.exec(SiliconSandwiches.SEED);

    this.handler = this.handle.bind(this);
    // LAMA: "API" improvisada para os testes, com os nomes que as outras versões têm em app.js.
    this.checkout = {
      checkout: (r) => this.doCheckout(r),
      getOrder: (id) => this.getOrder(id),
      menuFor: (storeId) => this.menu(storeId),
    };
    this.promoCache = null; // LAMA: cache global, "porque a página estava lenta"
  }

  close() {
    this.db.close();
  }

  // LAMA: SQL montado com concatenação de strings e aspas escapadas à mão.
  q(v) {
    if (v === undefined || v === null) return 'NULL';
    if (typeof v == 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v == 'boolean') return v ? '1' : '0';
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  }

  // ===========================================================================================
  // Router: um único método, um "if" por rota, com regras de negócio e SQL lá dentro.
  // ===========================================================================================
  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const m = req.method;
    const send = (status, body, type) => {
      if (type) {
        res.writeHead(status, { 'Content-Type': type });
        return res.end(body);
      }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body, null, 2));
    };

    let body;
    if (m != 'GET') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          return send(400, { error: 'O corpo do pedido não é JSON válido' });
        }
      }
    }

    try {
      let mm;
      if (m == 'GET' && p == '/') {
        send(200, this.renderPage(), 'text/html; charset=utf-8');
      } else if (m == 'GET' && p == '/routes') {
        // LAMA: lista escrita à mão, que alguém se há de esquecer de atualizar.
        send(200, {
          app: 'Silicon Sandwiches',
          style: 'big-ball-of-mud',
          routes: [
            'GET /', 'GET /routes', 'GET /health',
            'GET /stores/:storeId/menu', 'POST /checkout', 'GET /orders/:id',
            'GET /stores', 'POST /stores/:storeId/status',
            'GET /inventory/:storeId', 'POST /inventory/:storeId/restock',
            'GET /promotions', 'GET /kitchen/queue', 'POST /kitchen/tickets/:id/advance',
            'GET /deliveries', 'POST /deliveries/:id/advance', 'GET /recipes/:sandwichId',
          ],
        });
      } else if (m == 'GET' && p == '/health') {
        send(200, { status: 'ok', style: 'big-ball-of-mud', classes: ['SiliconSandwiches'] });
      } else if (m == 'GET' && (mm = p.match(/^\/stores\/([^/]+)\/menu$/))) {
        send(200, this.menu(decodeURIComponent(mm[1])));
      } else if (m == 'POST' && p == '/checkout') {
        send(201, await this.doCheckout(body));
      } else if (m == 'GET' && (mm = p.match(/^\/orders\/([^/]+)$/))) {
        send(200, this.getOrder(Number(mm[1])));
      } else if (m == 'GET' && p == '/stores') {
        send(200, this.db.prepare('SELECT * FROM store ORDER BY name').all()
          .map((s) => ({ id: s.id, name: s.name, city: s.city, address: s.address, open: s.open == 1 })));
      } else if (m == 'POST' && (mm = p.match(/^\/stores\/([^/]+)\/status$/))) {
        const id = decodeURIComponent(mm[1]);
        if (typeof body?.open != 'boolean') {
          throw Object.assign(new Error('open tem de ser true ou false'), { name: 'ValidationError', status: 422 });
        }
        if (this.db.prepare('UPDATE store SET open = ' + this.q(body.open) + ' WHERE id = ' + this.q(id)).run().changes != 1) {
          throw Object.assign(new Error('Loja desconhecida: ' + id), { name: 'NotFoundError', status: 404 });
        }
        const s = this.db.prepare('SELECT * FROM store WHERE id = ?').get(id);
        send(200, { id: s.id, name: s.name, city: s.city, address: s.address, open: s.open == 1 });
      } else if (m == 'GET' && p == '/promotions') {
        if (!this.promoCache) {
          this.promoCache = this.db.prepare('SELECT * FROM promotion_code WHERE active = 1 ORDER BY code').all().map((r) => ({
            code: r.code,
            description: r.description,
            percent: r.percent,
            amountCents: r.amount_cents,
            minSubtotalCents: r.min_subtotal_cents,
            storeId: r.store_id,
            maxUsesPerCustomer: r.max_uses_per_customer,
          }));
        }
        send(200, this.promoCache);
      } else if (m == 'GET' && (mm = p.match(/^\/inventory\/([^/]+)$/))) {
        const storeId = decodeURIComponent(mm[1]);
        send(200, {
          storeId,
          items: this.db.prepare('SELECT ingredient, quantity FROM stock_level WHERE store_id = ' + this.q(storeId) + ' ORDER BY ingredient')
            .all().map((r) => ({ ...r })),
        });
      } else if (m == 'POST' && (mm = p.match(/^\/inventory\/([^/]+)\/restock$/))) {
        const storeId = decodeURIComponent(mm[1]);
        const { ingredient, quantity } = body ?? {};
        if (typeof ingredient !== 'string' || !ingredient) {
          throw Object.assign(new Error('ingredient é obrigatório'), { name: 'ValidationError', status: 422 });
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw Object.assign(new Error('quantity tem de ser inteira positiva'), { name: 'ValidationError', status: 422 });
        }
        // LAMA: o mesmo "upsert" aparece outra vez em doCheckout() e em resetDb(), copiado e colado.
        this.db.exec('INSERT INTO stock_level (store_id, ingredient, quantity) VALUES (' + this.q(storeId) + ', ' + this.q(ingredient) + ', ' + quantity +
          ') ON CONFLICT (store_id, ingredient) DO UPDATE SET quantity = quantity + excluded.quantity');
        send(200, {
          storeId,
          items: this.db.prepare('SELECT ingredient, quantity FROM stock_level WHERE store_id = ? ORDER BY ingredient').all(storeId).map((r) => ({ ...r })),
        });
      } else if (m == 'GET' && (mm = p.match(/^\/recipes\/([^/]+)$/))) {
        const sandwichId = decodeURIComponent(mm[1]);
        const ingredients = this.db.prepare('SELECT ingredient, quantity, unit FROM recipe_ingredient WHERE sandwich_id = ? ORDER BY ingredient')
          .all(sandwichId).map((r) => ({ ...r }));
        if (ingredients.length) send(200, { sandwichId, ingredients });
        else send(404, { error: 'Receita não encontrada' });
      } else if (m == 'GET' && p == '/kitchen/queue') {
        const storeId = url.searchParams.get('storeId');
        const rows = storeId
          ? this.db.prepare('SELECT * FROM kitchen_ticket WHERE store_id = ? ORDER BY id DESC').all(storeId)
          : this.db.prepare('SELECT * FROM kitchen_ticket ORDER BY id DESC').all();
        send(200, rows.map((t) => this.ticket(t)));
      } else if (m == 'POST' && (mm = p.match(/^\/kitchen\/tickets\/([^/]+)\/advance$/))) {
        const id = Number(mm[1]);
        const t = this.db.prepare('SELECT * FROM kitchen_ticket WHERE id = ' + this.q(id)).get();
        if (!t) throw Object.assign(new Error('Bilhete ' + id + ' não existe'), { name: 'NotFoundError', status: 404 });
        // LAMA: máquina de estados num switch, repetida (com outra forma) no código do browser.
        let next;
        switch (t.status) {
          case 'QUEUED': next = 'PREPARING'; break;
          case 'PREPARING': next = 'READY'; break;
          case 'READY': next = 'COLLECTED'; break;
          default: throw Object.assign(new Error('O bilhete ' + id + ' já foi levantado'), { name: 'ValidationError', status: 422 });
        }
        this.db.exec("UPDATE kitchen_ticket SET status = '" + next + "', updated_at = datetime('now') WHERE id = " + id);
        send(200, this.ticket(this.db.prepare('SELECT * FROM kitchen_ticket WHERE id = ?').get(id)));
      } else if (m == 'GET' && p == '/deliveries') {
        send(200, this.db.prepare('SELECT * FROM delivery_job ORDER BY id DESC').all().map((r) => ({
          id: r.id, orderId: r.order_id, storeId: r.store_id, address: r.address, status: r.status,
          etaMinutes: r.eta_minutes, createdAt: r.created_at, updatedAt: r.updated_at,
        })));
      } else if (m == 'POST' && (mm = p.match(/^\/deliveries\/([^/]+)\/advance$/))) {
        const id = Number(mm[1]);
        let r = this.db.prepare('SELECT * FROM delivery_job WHERE id = ' + this.q(id)).get();
        if (!r) throw Object.assign(new Error('Entrega ' + id + ' não existe'), { name: 'NotFoundError', status: 404 });
        if (r.status == 'DELIVERED') {
          throw Object.assign(new Error('A entrega ' + id + ' já foi concluída'), { name: 'ValidationError', status: 422 });
        }
        this.db.exec("UPDATE delivery_job SET status = '" + (r.status == 'SCHEDULED' ? 'OUT_FOR_DELIVERY' : 'DELIVERED') +
          "', updated_at = datetime('now') WHERE id = " + id);
        r = this.db.prepare('SELECT * FROM delivery_job WHERE id = ?').get(id);
        // LAMA: o mesmo mapeamento de colunas que em GET /deliveries, copiado.
        send(200, {
          id: r.id, orderId: r.order_id, storeId: r.store_id, address: r.address, status: r.status,
          etaMinutes: r.eta_minutes, createdAt: r.created_at, updatedAt: r.updated_at,
        });
      } else {
        send(404, { error: `Rota não encontrada: ${m} ${p}` });
      }
    } catch (err) {
      // LAMA: os códigos HTTP vêm de dentro das regras de negócio (err.status), não de uma camada de apresentação.
      const status = err.status ?? 500;
      if (status == 500) console.error(err);
      send(status, { error: err.message });
    }
  }

  // LAMA: a cozinha não tem tabela de artigos; lê diretamente as linhas da encomenda (tabelas do checkout).
  ticket(t) {
    return t && {
      id: t.id,
      orderId: t.order_id,
      storeId: t.store_id,
      status: t.status,
      items: this.db.prepare('SELECT name, quantity FROM order_line WHERE order_id = ? ORDER BY name').all(t.order_id).map((i) => ({ ...i })),
      receivedAt: t.received_at,
      updatedAt: t.updated_at,
    };
  }

  // Menu da loja: a regra da personalização local escrita em SQL...
  menu(storeId) {
    return this.db.prepare(`
      SELECT s.id, s.name, COALESCE(m.price_cents, s.base_price_cents) AS priceCents
      FROM sandwich s LEFT JOIN store_menu m ON m.sandwich_id = s.id AND m.store_id = ?
      WHERE COALESCE(m.available, CASE WHEN s.local_only = 1 THEN 0 ELSE 1 END) = 1
      ORDER BY s.name`).all(storeId).map((r) => ({ ...r }));
  }

  getOrder(id) {
    const row = this.db.prepare('SELECT * FROM customer_order WHERE id = ' + this.q(id)).get();
    if (!row) throw Object.assign(new Error(`Encomenda ${id} não existe`), { name: 'NotFoundError', status: 404 });
    return {
      id: row.id,
      storeId: row.store_id,
      customerId: row.customer_id,
      fulfilment: row.fulfilment,
      status: row.status,
      lines: this.db.prepare('SELECT * FROM order_line WHERE order_id = ? ORDER BY sandwich_id').all(id).map((l) => ({
        sandwichId: l.sandwich_id,
        name: l.name,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
      })),
      subtotalCents: row.subtotal_cents,
      discountCents: row.discount_cents,
      deliveryFeeCents: row.delivery_fee_cents,
      totalCents: row.total_cents,
      promoCode: row.promo_code,
      paymentRef: row.payment_ref,
      createdAt: row.created_at,
    };
  }

  // ===========================================================================================
  // O checkout: um método longo que faz o trabalho de sete componentes, sem fronteiras entre eles.
  // ===========================================================================================
  async doCheckout(b) {
    if (!b || typeof b !== 'object') throw Object.assign(new Error('Pedido vazio'), { name: 'ValidationError', status: 422 });
    const fulfilment = b.fulfilment ?? 'pickup';
    if (typeof b.storeId !== 'string' || !b.storeId) throw Object.assign(new Error('storeId é obrigatório'), { name: 'ValidationError', status: 422 });
    if (typeof b.customerId !== 'string' || !b.customerId) throw Object.assign(new Error('customerId é obrigatório'), { name: 'ValidationError', status: 422 });
    if (!Array.isArray(b.items) || b.items.length == 0) throw Object.assign(new Error('A encomenda não tem artigos'), { name: 'ValidationError', status: 422 });
    if (fulfilment != 'pickup' && fulfilment != 'delivery') throw Object.assign(new Error('fulfilment tem de ser pickup ou delivery'), { name: 'ValidationError', status: 422 });
    if (fulfilment == 'delivery' && !b.address) throw Object.assign(new Error('A entrega ao domicílio precisa de morada'), { name: 'ValidationError', status: 422 });
    const qty = new Map();
    for (const it of b.items) {
      if (typeof it?.sandwichId !== 'string' || !Number.isInteger(it.quantity) || it.quantity < 1) {
        throw Object.assign(new Error('Cada artigo precisa de sandwichId e de uma quantity inteira positiva'), { name: 'ValidationError', status: 422 });
      }
      qty.set(it.sandwichId, (qty.get(it.sandwichId) ?? 0) + it.quantity);
    }

    // Loja
    const store = this.db.prepare('SELECT * FROM store WHERE id = ' + this.q(b.storeId)).get();
    if (!store) throw Object.assign(new Error('Loja desconhecida: ' + b.storeId), { name: 'NotFoundError', status: 404 });
    if (store.open != 1) throw Object.assign(new Error(`A loja ${store.name} está fechada`), { name: 'ValidationError', status: 422 });

    // LAMA: ...e a mesma regra outra vez, agora em JavaScript. Se uma mudar e a outra não, o menu mostra
    // um preço e o checkout cobra outro.
    const lines = [];
    let subtotal = 0;
    for (const [sandwichId, quantity] of qty) {
      const s = this.db.prepare('SELECT * FROM sandwich WHERE id = ?').get(sandwichId);
      const o = this.db.prepare('SELECT * FROM store_menu WHERE store_id = ? AND sandwich_id = ?').get(store.id, sandwichId);
      const available = s && (o ? o.available == 1 : s.local_only != 1);
      if (!available) throw Object.assign(new Error(`"${sandwichId}" não está no menu de ${store.name}`), { name: 'ValidationError', status: 422 });
      const price = o && o.price_cents != null ? o.price_cents : s.base_price_cents;
      lines.push({ sandwichId, name: s.name, quantity, unitPriceCents: price });
      subtotal += quantity * price;
    }

    // Promoção
    let discount = 0;
    if (b.promoCode) {
      const promo = this.db.prepare('SELECT * FROM promotion_code WHERE code = ' + this.q(b.promoCode) + ' AND active = 1').get();
      if (!promo) throw Object.assign(new Error('Código promocional inválido: ' + b.promoCode), { name: 'ValidationError', status: 422 });
      if (promo.store_id && promo.store_id != store.id) {
        throw Object.assign(new Error(b.promoCode + ' não é válido nesta loja'), { name: 'ValidationError', status: 422 });
      }
      if (subtotal < promo.min_subtotal_cents) {
        throw Object.assign(new Error(`${b.promoCode} só se aplica a partir de ${promo.min_subtotal_cents / 100} €`), { name: 'ValidationError', status: 422 });
      }
      if (promo.max_uses_per_customer &&
        this.db.prepare('SELECT COUNT(*) AS n FROM promotion_redemption WHERE code = ? AND customer_id = ?').get(b.promoCode, b.customerId).n >= promo.max_uses_per_customer) {
        throw Object.assign(new Error(`${b.customerId} já usou o código ${b.promoCode}`), { name: 'ValidationError', status: 422 });
      }
      discount = promo.percent ? Math.round((subtotal * promo.percent) / 100) : Math.min(promo.amount_cents, subtotal);
    }

    // Entrega
    let fee = 0;
    let zone;
    if (fulfilment == 'delivery') {
      zone = this.db.prepare('SELECT * FROM delivery_zone WHERE store_id = ?').get(store.id);
      if (!zone) throw Object.assign(new Error(`A loja ${store.name} não faz entregas`), { name: 'ValidationError', status: 422 });
      fee = zone.fee_cents;
    }
    const total = subtotal - discount + fee;

    // Stock: receitas → ingredientes → reserva
    const needs = new Map();
    for (const l of lines) {
      const recipe = this.db.prepare('SELECT * FROM recipe_ingredient WHERE sandwich_id = ? ORDER BY ingredient').all(l.sandwichId);
      if (!recipe.length) throw Object.assign(new Error('Não há receita para ' + l.name), { name: 'ValidationError', status: 422 });
      for (const r of recipe) needs.set(r.ingredient, (needs.get(r.ingredient) ?? 0) + r.quantity * l.quantity);
    }
    this.db.exec('BEGIN');
    let reservationId;
    try {
      reservationId = Number(this.db.prepare("INSERT INTO stock_reservation (store_id, status) VALUES (?, 'ACTIVE')").run(store.id).lastInsertRowid);
      for (const [ingredient, quantity] of needs) {
        const ok = this.db.prepare('UPDATE stock_level SET quantity = quantity - ' + quantity + ' WHERE store_id = ' + this.q(store.id) +
          ' AND ingredient = ' + this.q(ingredient) + ' AND quantity >= ' + quantity).run().changes == 1;
        if (!ok) throw Object.assign(new Error(`Não há ${ingredient} suficiente em ${store.id}`), { name: 'ValidationError', status: 422 });
        this.db.prepare('INSERT INTO stock_reservation_line (reservation_id, ingredient, quantity) VALUES (?, ?, ?)').run(reservationId, ingredient, quantity);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }

    // Pagamento (o gateway do banco continua simulado, como nas outras versões)
    if (b.customerId == 'sem-saldo') {
      if (!process.env.SILENT) console.log(`  [Payment · mock] recusado o pagamento de ${total} cêntimos`);
      // Devolver o stock (compensação)
      this.db.exec('BEGIN');
      for (const l of this.db.prepare('SELECT * FROM stock_reservation_line WHERE reservation_id = ?').all(reservationId)) {
        this.db.exec('INSERT INTO stock_level (store_id, ingredient, quantity) VALUES (' + this.q(store.id) + ', ' + this.q(l.ingredient) + ', ' + l.quantity +
          ') ON CONFLICT (store_id, ingredient) DO UPDATE SET quantity = quantity + excluded.quantity');
      }
      this.db.exec("UPDATE stock_reservation SET status = 'RELEASED' WHERE id = " + reservationId);
      this.db.exec('COMMIT');
      throw Object.assign(new Error('Pagamento recusado pelo banco'), { name: 'PaymentDeclinedError', status: 402 });
    }
    const paymentRef = 'PAY-' + randomUUID().slice(0, 8).toUpperCase();
    if (!process.env.SILENT) console.log(`  [Payment · mock] cobrados ${total} cêntimos a ${b.customerId} (${paymentRef})`);

    // LAMA: encomenda, utilização do código, bilhete da cozinha e entrega numa só transação, porque está tudo
    // à mão. É cómodo, mas torna impossível separar estas partes mais tarde.
    this.db.exec('BEGIN');
    let orderId;
    try {
      orderId = Number(this.db.prepare(`INSERT INTO customer_order (store_id, customer_id, fulfilment, subtotal_cents, discount_cents,
        delivery_fee_cents, total_cents, promo_code, payment_ref, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLACED')`)
        .run(store.id, b.customerId, fulfilment, subtotal, discount, fee, total, b.promoCode ?? null, paymentRef).lastInsertRowid);
      for (const l of lines) {
        this.db.prepare('INSERT INTO order_line (order_id, sandwich_id, name, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)')
          .run(orderId, l.sandwichId, l.name, l.quantity, l.unitPriceCents);
      }
      if (b.promoCode) {
        this.db.prepare('INSERT INTO promotion_redemption (code, customer_id, order_id, discount_cents) VALUES (?, ?, ?, ?)')
          .run(b.promoCode, b.customerId, orderId, discount);
      }
      this.db.prepare("INSERT INTO kitchen_ticket (order_id, store_id, status) VALUES (?, ?, 'QUEUED')").run(orderId, store.id);
      if (fulfilment == 'delivery') {
        this.db.prepare("INSERT INTO delivery_job (order_id, store_id, address, status, eta_minutes) VALUES (?, ?, ?, 'SCHEDULED', ?)")
          .run(orderId, store.id, b.address, zone.eta_minutes);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return this.getOrder(orderId);
  }

  // ===========================================================================================
  // A "vista": HTML montado em strings, com SELECTs lá dentro. A página vai diretamente à base de dados.
  // ===========================================================================================
  renderPage() {
    const stores = this.db.prepare('SELECT * FROM store ORDER BY name').all();
    return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Silicon Sandwiches</title>
  <style>${SiliconSandwiches.CSS}</style>
</head>
<body data-style="mud">
  <header class="topbar">
    <div class="brand">
      <span class="logo">🥪</span>
      <div>
        <h1>Silicon Sandwiches</h1>
        <p>Encomendas online · personalização por loja</p>
      </div>
    </div>
    <span id="style-badge" class="badge">🍝 Big Ball of Mud</span>
  </header>

  <main class="layout">
    <section class="panel">
      <h2><span class="step">1</span> Escolher a loja</h2>
      <div id="stores" class="stores">${stores.map((s) => `
        <button class="store ${s.open == 1 ? '' : 'closed'}" data-id="${this.esc(s.id)}">
          <strong>${this.esc(s.name)}</strong>
          <small>${this.esc(s.city)}</small><br>
          <span class="pill ${s.open == 1 ? 'open' : 'closed'}">${s.open == 1 ? 'aberta' : 'fechada'}</span>
        </button>`).join('')}</div>

      <h2><span class="step">2</span> Menu <span id="menu-store" class="muted"></span></h2>
      <div id="menu" class="menu"><p class="muted">Escolha uma loja para ver o menu.</p></div>
    </section>

    <aside class="panel cart">
      <h2><span class="step">3</span> A sua encomenda</h2>
      <ul id="cart-lines" class="cart-lines"></ul>
      <div class="cart-subtotal"><span>Subtotal estimado</span><strong id="cart-subtotal">0,00 €</strong></div>

      <form id="checkout-form">
        <label>Cliente
          <input id="customer" value="ana" required>
          <small>Use <code>sem-saldo</code> para simular um pagamento recusado.</small>
        </label>

        <div class="toggle" role="radiogroup" aria-label="Entrega">
          <label><input type="radio" name="fulfilment" value="pickup" checked><span>🏪 Levantar na loja</span></label>
          <label><input type="radio" name="fulfilment" value="delivery"><span>🛵 Entrega</span></label>
        </div>

        <label id="address-field" hidden>Morada
          <input id="address" placeholder="Rua de Santa Catarina, 100">
        </label>

        <label>Código promocional
          <input id="promo" placeholder="FCUL10" autocomplete="off">
          <span id="promo-chips" class="promo-chips">${this.db.prepare('SELECT code, description FROM promotion_code WHERE active = 1 ORDER BY code').all()
            .map((p) => `<button type="button" class="promo-chip" data-promo="${this.esc(p.code)}" title="${this.esc(p.description)}">${this.esc(p.code)}</button>`).join('')}</span>
        </label>

        <button id="submit" class="primary" type="submit" disabled>Finalizar encomenda</button>
      </form>

      <div id="result"></div>
    </aside>
  </main>

  <section class="panel backstage">
    <h2>Bastidores <span class="muted">o que aconteceu do lado do servidor</span></h2>
    <div id="architecture" class="architecture">
      <span class="label">Camadas:</span><span class="chip real">SiliconSandwiches.js</span>
      <span class="muted">· HTML, CSS, JavaScript do browser, HTTP, regras de negócio, SQL e dados, tudo na mesma classe</span>
    </div>
    <div class="backstage-grid">
      <div>
        <h3>👩‍🍳 Cozinha <span class="tag">MakeOrder</span></h3>
        <ul id="kitchen" class="feed">${this.db.prepare(`
          SELECT t.id, t.order_id, t.store_id, t.status,
                 (SELECT group_concat(x, ', ') FROM (SELECT l.quantity || '× ' || l.name AS x FROM order_line l
                   WHERE l.order_id = t.order_id ORDER BY l.name)) AS items
          FROM kitchen_ticket t ORDER BY t.id DESC`).all().map((t) => `
          <li>
            <div class="row">
              <span><strong>Encomenda #${t.order_id}</strong> · ${this.esc(t.store_id)}</span>
              <span class="state ${t.status == 'COLLECTED' ? 'done' : ''}">${t.status}</span>
            </div>
            <div class="row">
              <span>${this.esc(t.items ?? '')}</span>
              ${t.status == 'COLLECTED' ? '' : `<button class="advance" data-advance="/kitchen/tickets/${t.id}/advance">avançar ›</button>`}
            </div>
          </li>`).join('') || '<li class="muted">Sem encomendas.</li>'}</ul>
      </div>
      <div>
        <h3>🛵 Entregas <span class="tag">Delivery</span></h3>
        <ul id="deliveries" class="feed">${this.db.prepare('SELECT * FROM delivery_job ORDER BY id DESC').all().map((d) => `
          <li>
            <div class="row">
              <span><strong>Encomenda #${d.order_id}</strong> · ETA ${d.eta_minutes} min</span>
              <span class="state ${d.status == 'DELIVERED' ? 'done' : ''}">${d.status}</span>
            </div>
            <div class="row">
              <span>→ ${this.esc(d.address)}</span>
              ${d.status == 'DELIVERED' ? '' : `<button class="advance" data-advance="/deliveries/${d.id}/advance">avançar ›</button>`}
            </div>
          </li>`).join('') || '<li class="muted">Sem entregas.</li>'}</ul>
      </div>
      <div>
        <h3>📦 Stock <span class="tag">ManageInventory</span> <span id="stock-store" class="muted"></span></h3>
        <ul id="stock" class="stock"><li class="muted">Escolha uma loja.</li></ul>
      </div>
      <div>
        <h3>🔌 Pedidos HTTP</h3>
        <ul id="http-log" class="feed mono"><li class="muted">A página chegou já preenchida: o HTML foi gerado com SQL lá dentro.</li></ul>
      </div>
    </div>
  </section>

  <footer>Design de Software · FCUL · <a href="/routes">rotas da API</a></footer>

  <script>window.STORES = ${JSON.stringify(stores.map((s) => ({ id: s.id, name: s.name, city: s.city, open: s.open == 1 }))).replace(/</g, '\\u003c')};</script>
  <script>(${SiliconSandwiches.browser})();</script>
</body>
</html>`;
  }

  // LAMA: este código corre no browser, mas vive na mesma classe que o SQL. É enviado tal como está escrito
  // (Function.prototype.toString) e repete a forma de desenhar a cozinha e as entregas de renderPage().
  static browser = function () {
    const $ = (sel) => document.querySelector(sel);
    const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const EMOJI = { 'tosta-mista': '🥪', bifana: '🥩', prego: '🥖', 'wrap-vegan': '🌯', francesinha: '🧀' };
    const state = { stores: window.STORES, store: null, menu: [], cart: new Map() };

    async function api(method, path, body) {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      const li = document.createElement('li');
      li.innerHTML = `<span class="status s${String(res.status)[0]}">${res.status}</span>${method} ${esc(path)}`;
      $('#http-log').prepend(li);
      while ($('#http-log').children.length > 15) $('#http-log').lastChild.remove();
      if (!res.ok) throw Object.assign(new Error(data?.error ?? res.statusText), { status: res.status });
      return data;
    }

    async function selectStore(id) {
      state.store = state.stores.find((s) => s.id === id);
      document.querySelectorAll('.store').forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
      $('#menu-store').textContent = `· ${state.store.name}`;
      state.menu = await api('GET', `/stores/${encodeURIComponent(id)}/menu`);
      $('#menu').innerHTML = state.menu.map((item) => `
        <div class="item">
          <span class="emoji">${EMOJI[item.id] ?? '🥪'}</span>
          <strong>${esc(item.name)}</strong>
          <div class="recipe" id="recipe-${item.id}">
            <button class="link" data-recipe="${item.id}">ver ingredientes</button>
          </div>
          <div class="row">
            <span class="price">${euros(item.priceCents)}</span>
            <button class="add" data-add="${item.id}">+ Adicionar</button>
          </div>
        </div>`).join('');
      renderCart();
      loadStock();
    }

    function renderCart() {
      const prices = new Map(state.menu.map((m) => [m.id, m.priceCents]));
      let subtotal = 0;
      $('#cart-lines').innerHTML = [...state.cart.values()].map((line) => {
        const price = prices.get(line.id);
        if (price !== undefined) subtotal += price * line.quantity;
        return `
          <li>
            <span>${EMOJI[line.id] ?? '🥪'} ${esc(line.name)}</span>
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

    async function loadBackstage() {
      const [queue, deliveries] = await Promise.all([api('GET', '/kitchen/queue'), api('GET', '/deliveries')]);
      $('#kitchen').innerHTML = queue.map((t) => `
        <li>
          <div class="row">
            <span><strong>Encomenda #${t.orderId}</strong> · ${esc(t.storeId)}</span>
            <span class="state ${t.status === 'COLLECTED' ? 'done' : ''}">${t.status}</span>
          </div>
          <div class="row">
            <span>${t.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join(', ')}</span>
            ${t.status === 'COLLECTED' ? '' : `<button class="advance" data-advance="/kitchen/tickets/${t.id}/advance">avançar ›</button>`}
          </div>
        </li>`).join('') || '<li class="muted">Sem encomendas.</li>';
      $('#deliveries').innerHTML = deliveries.map((d) => `
        <li>
          <div class="row">
            <span><strong>Encomenda #${d.orderId}</strong> · ETA ${d.etaMinutes} min</span>
            <span class="state ${d.status === 'DELIVERED' ? 'done' : ''}">${d.status}</span>
          </div>
          <div class="row">
            <span>→ ${esc(d.address)}</span>
            ${d.status === 'DELIVERED' ? '' : `<button class="advance" data-advance="/deliveries/${d.id}/advance">avançar ›</button>`}
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
          <span>${esc(i.ingredient)}</span><strong>${i.quantity}</strong>
          <span class="bar"><span style="width:${(100 * i.quantity) / max}%"></span></span>
        </li>`).join('') || '<li class="muted">Sem stock.</li>';
    }

    document.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.classList.contains('store')) {
        selectStore(t.dataset.id);
      } else if (t.dataset.add) {
        const item = state.menu.find((m) => m.id === t.dataset.add);
        const line = state.cart.get(item.id) ?? { id: item.id, name: item.name, quantity: 0 };
        line.quantity += 1;
        state.cart.set(item.id, line);
        renderCart();
      } else if (t.dataset.qty) {
        const line = state.cart.get(t.dataset.qty);
        line.quantity += Number(t.dataset.delta);
        if (line.quantity <= 0) state.cart.delete(t.dataset.qty);
        renderCart();
      } else if (t.dataset.recipe) {
        const box = document.getElementById(`recipe-${t.dataset.recipe}`);
        try {
          const recipe = await api('GET', `/recipes/${encodeURIComponent(t.dataset.recipe)}`);
          box.textContent = recipe.ingredients.map((i) => `${i.quantity} ${i.unit} ${i.ingredient}`).join(', ');
        } catch {
          box.textContent = 'Receita indisponível.';
        }
      } else if (t.dataset.advance) {
        try {
          await api('POST', t.dataset.advance);
        } finally {
          loadBackstage();
        }
      } else if (t.dataset.promo) {
        $('#promo').value = t.dataset.promo;
      }
    });

    document.querySelectorAll('input[name="fulfilment"]').forEach((radio) =>
      radio.addEventListener('change', () => {
        const delivery = radio.value === 'delivery' && radio.checked;
        $('#address-field').hidden = !delivery;
        $('#address').required = delivery;
      }));

    $('#checkout-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const fulfilment = document.querySelector('input[name="fulfilment"]:checked').value;
      $('#submit').disabled = true;
      try {
        const o = await api('POST', '/checkout', {
          storeId: state.store.id,
          customerId: $('#customer').value.trim(),
          items: [...state.cart.values()].map(({ id, quantity }) => ({ sandwichId: id, quantity })),
          promoCode: $('#promo').value.trim() || undefined,
          fulfilment,
          address: fulfilment === 'delivery' ? $('#address').value.trim() : undefined,
        });
        $('#result').innerHTML = `
          <div class="result ok">
            <h3>✔ Encomenda #${o.id} confirmada</h3>
            <table class="receipt">
              ${o.lines.map((l) => `<tr><td>${l.quantity}× ${esc(l.name)}</td><td>${euros(l.quantity * l.unitPriceCents)}</td></tr>`).join('')}
              <tr><td>Desconto ${o.promoCode ? `(${esc(o.promoCode)})` : ''}</td><td>− ${euros(o.discountCents)}</td></tr>
              <tr><td>Entrega</td><td>${euros(o.deliveryFeeCents)}</td></tr>
              <tr class="total"><td>Total</td><td>${euros(o.totalCents)}</td></tr>
            </table>
            <p class="muted">Pagamento ${esc(o.paymentRef)} · <a href="/orders/${o.id}" target="_blank">ver JSON</a></p>
          </div>`;
        state.cart.clear();
        renderCart();
      } catch (err) {
        $('#result').innerHTML = `
          <div class="result err">
            <h3>✘ Encomenda recusada <span class="mono">HTTP ${err.status ?? '?'}</span></h3>
            ${esc(err.message)}
          </div>`;
        $('#submit').disabled = false;
      }
      loadBackstage();
    });

    renderCart();
  };

  // ===========================================================================================
  // Linha de comandos: servidor, demo e limpeza, também aqui dentro.
  // ===========================================================================================
  static async main(args) {
    const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));

    if (args.includes('--demo')) {
      const app = new SiliconSandwiches();
      const euros = (c) => `${(c / 100).toFixed(2).replace('.', ',')} €`;
      const tries = [
        ['Porto: francesinha + 2 tostas, código FCUL10, entrega ao domicílio', { storeId: 'porto-aliados', customerId: 'ana',
          items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
          promoCode: 'FCUL10', fulfilment: 'delivery', address: 'Rua de Santa Catarina, 100, Porto' }],
        ['Lisboa: bifana (preço local), levantamento na loja', { storeId: 'lisboa-campo-grande', customerId: 'rui', items: [{ sandwichId: 'bifana', quantity: 2 }] }],
        ['Lisboa: francesinha (só existe no Porto)', { storeId: 'lisboa-campo-grande', customerId: 'rui', items: [{ sandwichId: 'francesinha', quantity: 1 }] }],
        ['Coimbra: loja fechada', { storeId: 'coimbra-baixa', customerId: 'ines', items: [{ sandwichId: 'tosta-mista', quantity: 1 }] }],
        ['Porto: pagamento recusado', { storeId: 'porto-aliados', customerId: 'sem-saldo', items: [{ sandwichId: 'prego', quantity: 1 }] }],
        ['Lisboa: código PORTO15 (só vale no Porto)', { storeId: 'lisboa-campo-grande', customerId: 'rui', items: [{ sandwichId: 'bifana', quantity: 1 }], promoCode: 'PORTO15' }],
        ['Lisboa: BEMVINDO pela primeira vez', { storeId: 'lisboa-campo-grande', customerId: 'marta', items: [{ sandwichId: 'wrap-vegan', quantity: 2 }], promoCode: 'BEMVINDO' }],
        ['Lisboa: BEMVINDO pela segunda vez (limite de 1 por cliente)', { storeId: 'lisboa-campo-grande', customerId: 'marta', items: [{ sandwichId: 'wrap-vegan', quantity: 2 }], promoCode: 'BEMVINDO' }],
        ['Porto: 11 francesinhas (só há molho para 10)', { storeId: 'porto-aliados', customerId: 'ana', items: [{ sandwichId: 'francesinha', quantity: 11 }] }],
      ];
      for (const [title, request] of tries) {
        console.log(`\n▶ ${title}`);
        try {
          const o = await app.doCheckout(request);
          for (const l of o.lines) console.log(`    ${l.quantity}× ${l.name} a ${euros(l.unitPriceCents)}`);
          console.log(`  ✔ Encomenda #${o.id} (${o.fulfilment}): ${euros(o.subtotalCents)} − ${euros(o.discountCents)}` +
            ` + ${euros(o.deliveryFeeCents)} = ${euros(o.totalCents)}`);
        } catch (err) {
          console.log(`  ✘ ${err.name}: ${err.message}`);
        }
      }
      app.close();
    } else if (args.includes('--reset')) {
      // Apaga o que os checkouts criaram (mantém o catálogo) e devolve ao stock as reservas ativas.
      if (!existsSync(dbPath)) return console.log(`Não existe base de dados em ${dbPath}: nada a limpar.`);
      const app = new SiliconSandwiches(dbPath);
      const tables = ['delivery_job', 'kitchen_ticket', 'promotion_redemption', 'stock_reservation_line', 'stock_reservation', 'order_line', 'customer_order'];
      app.db.exec('BEGIN');
      for (const r of app.db.prepare(`SELECT r.store_id, l.ingredient, l.quantity FROM stock_reservation_line l
          JOIN stock_reservation r ON r.id = l.reservation_id WHERE r.status = 'ACTIVE'`).all()) {
        app.db.exec('INSERT INTO stock_level (store_id, ingredient, quantity) VALUES (' + app.q(r.store_id) + ', ' + app.q(r.ingredient) + ', ' + r.quantity +
          ') ON CONFLICT (store_id, ingredient) DO UPDATE SET quantity = quantity + excluded.quantity');
      }
      for (const t of tables) console.log(`${t}: ${app.db.prepare('DELETE FROM ' + t).run().changes} linha(s) apagada(s)`);
      app.db.exec('DELETE FROM sqlite_sequence WHERE name IN (' + tables.map((t) => app.q(t)).join(', ') + ')');
      app.db.exec('COMMIT');
      app.close();
      console.log(`Base de dados limpa (catálogo mantido): ${dbPath}`);
    } else {
      const port = Number(process.env.PORT ?? 3002);
      const app = new SiliconSandwiches(dbPath);
      createServer(app.handler).listen(port, () => {
        console.log(`Silicon Sandwiches (Big Ball of Mud) em http://localhost:${port}`);
        console.log(`Base de dados: ${dbPath}`);
      });
    }
  }

  // ===========================================================================================
  // Esquema, dados de exemplo e CSS, no fundo da classe.
  // ===========================================================================================

  // LAMA: uma base de dados partilhada por tudo; qualquer linha da classe lê e escreve qualquer tabela.
  static SCHEMA = `
    CREATE TABLE IF NOT EXISTS store (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, open INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sandwich (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, base_price_cents INTEGER NOT NULL, local_only INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS store_menu (
      store_id TEXT NOT NULL, sandwich_id TEXT NOT NULL, price_cents INTEGER, available INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (store_id, sandwich_id));
    CREATE TABLE IF NOT EXISTS customer_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT, store_id TEXT NOT NULL, customer_id TEXT NOT NULL, fulfilment TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL, delivery_fee_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL, promo_code TEXT, payment_ref TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS order_line (
      order_id INTEGER NOT NULL, sandwich_id TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL, PRIMARY KEY (order_id, sandwich_id));
    CREATE TABLE IF NOT EXISTS recipe_ingredient (
      sandwich_id TEXT NOT NULL, ingredient TEXT NOT NULL, quantity INTEGER NOT NULL, unit TEXT NOT NULL,
      PRIMARY KEY (sandwich_id, ingredient));
    CREATE TABLE IF NOT EXISTS stock_level (
      store_id TEXT NOT NULL, ingredient TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity >= 0),
      PRIMARY KEY (store_id, ingredient));
    CREATE TABLE IF NOT EXISTS stock_reservation (
      id INTEGER PRIMARY KEY AUTOINCREMENT, store_id TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS stock_reservation_line (
      reservation_id INTEGER NOT NULL, ingredient TEXT NOT NULL, quantity INTEGER NOT NULL,
      PRIMARY KEY (reservation_id, ingredient));
    CREATE TABLE IF NOT EXISTS promotion_code (
      code TEXT PRIMARY KEY, description TEXT NOT NULL, percent INTEGER, amount_cents INTEGER,
      min_subtotal_cents INTEGER NOT NULL DEFAULT 0, store_id TEXT, max_uses_per_customer INTEGER,
      active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS promotion_redemption (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, customer_id TEXT NOT NULL, order_id INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL, redeemed_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS kitchen_ticket (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE, store_id TEXT NOT NULL, status TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS delivery_zone (
      store_id TEXT PRIMARY KEY, fee_cents INTEGER NOT NULL, eta_minutes INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS delivery_job (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE, store_id TEXT NOT NULL, address TEXT NOT NULL,
      status TEXT NOT NULL, eta_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  `;

  // Os mesmos dados de exemplo das outras versões (preços, stocks, taxas e códigos são inventados).
  static SEED = `
    INSERT INTO store (id, name, city, address, open) VALUES
      ('lisboa-campo-grande', 'Lisboa · Campo Grande', 'Lisboa',  'Campo Grande 16',      1),
      ('porto-aliados',       'Porto · Aliados',       'Porto',   'Avenida dos Aliados 10', 1),
      ('coimbra-baixa',       'Coimbra · Baixa',       'Coimbra', 'Rua Ferreira Borges 5', 0);
    INSERT INTO sandwich (id, name, base_price_cents, local_only) VALUES
      ('tosta-mista', 'Tosta mista', 350, 0), ('bifana', 'Bifana', 450, 0), ('prego', 'Prego no pão', 550, 0),
      ('wrap-vegan', 'Wrap vegan', 500, 0), ('francesinha', 'Francesinha em sandes', 700, 1);
    INSERT INTO store_menu (store_id, sandwich_id, price_cents, available) VALUES
      ('porto-aliados', 'francesinha', 650, 1), ('lisboa-campo-grande', 'bifana', 480, 1), ('lisboa-campo-grande', 'prego', NULL, 0);
    INSERT INTO recipe_ingredient (sandwich_id, ingredient, quantity, unit) VALUES
      ('tosta-mista', 'pão de forma', 2, 'fatia'), ('tosta-mista', 'fiambre', 1, 'fatia'), ('tosta-mista', 'queijo', 2, 'fatia'),
      ('tosta-mista', 'manteiga', 1, 'dose'), ('bifana', 'papo-seco', 1, 'un'), ('bifana', 'febra de porco', 1, 'un'),
      ('prego', 'papo-seco', 1, 'un'), ('prego', 'bife', 1, 'un'), ('prego', 'manteiga', 1, 'dose'),
      ('wrap-vegan', 'tortilha', 1, 'un'), ('wrap-vegan', 'húmus', 1, 'dose'), ('wrap-vegan', 'legumes', 1, 'dose'),
      ('francesinha', 'pão de forma', 2, 'fatia'), ('francesinha', 'linguiça', 1, 'un'), ('francesinha', 'fiambre', 1, 'fatia'),
      ('francesinha', 'bife', 1, 'un'), ('francesinha', 'queijo', 3, 'fatia'), ('francesinha', 'molho de francesinha', 1, 'dose');
    WITH stores (store_id) AS (VALUES ('lisboa-campo-grande'), ('porto-aliados'), ('coimbra-baixa')),
         ingredients (ingredient) AS (VALUES ('pão de forma'), ('fiambre'), ('queijo'), ('manteiga'),
           ('papo-seco'), ('febra de porco'), ('bife'), ('tortilha'), ('húmus'), ('legumes'))
    INSERT INTO stock_level (store_id, ingredient, quantity) SELECT store_id, ingredient, 40 FROM stores, ingredients;
    INSERT INTO stock_level (store_id, ingredient, quantity) VALUES
      ('porto-aliados', 'linguiça', 15), ('porto-aliados', 'molho de francesinha', 10);
    INSERT INTO promotion_code (code, description, percent, amount_cents, min_subtotal_cents, store_id, max_uses_per_customer) VALUES
      ('FCUL10',   '10% para a comunidade FCUL',    10,   NULL, 0,    NULL,            NULL),
      ('MENOS1',   '1 € de desconto acima de 10 €', NULL, 100,  1000, NULL,            NULL),
      ('PORTO15',  '15% só na loja dos Aliados',    15,   NULL, 0,    'porto-aliados', NULL),
      ('BEMVINDO', '2 € na primeira encomenda',     NULL, 200,  500,  NULL,            1);
    INSERT INTO delivery_zone (store_id, fee_cents, eta_minutes) VALUES
      ('lisboa-campo-grande', 300, 35), ('porto-aliados', 250, 30);
  `;

  static CSS = `
:root {
  --bg: #fbf6ef; --panel: #ffffff; --ink: #2b2118; --muted: #8a7b6d; --line: #eadfd2;
  --brand: #e8590c; --brand-soft: #fff0e3; --ok: #2b8a3e; --ok-soft: #ebfbee; --err: #c92a2a; --err-soft: #fff5f5;
  --accent: #8c6239; --accent-soft: #f5ece1; /* castanho: a cor da lama */
  --radius: 14px; --shadow: 0 1px 2px rgb(43 33 24 / 6%), 0 4px 16px rgb(43 33 24 / 6%);
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, 'Segoe UI', Roboto, sans-serif; }
h1, h2, h3 { margin: 0; }
h2 { font-size: 1.05rem; margin: 4px 0 14px; display: flex; align-items: center; gap: 8px; }
h3 { font-size: 0.95rem; margin-bottom: 8px; }
code, .mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.85em; }
.muted { color: var(--muted); font-weight: 400; font-size: 0.9em; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 28px; background: linear-gradient(120deg, var(--brand), #f59f00); color: #fff; }
.brand { display: flex; align-items: center; gap: 14px; }
.brand h1 { font-size: 1.4rem; letter-spacing: 0.2px; }
.brand p { margin: 0; opacity: 0.9; font-size: 0.9rem; }
.logo { font-size: 2.2rem; background: #fff3; border-radius: 12px; padding: 4px 10px; }
.badge { background: var(--accent); color: #fff; border: 2px solid #fff8; padding: 6px 14px; border-radius: 999px; font-weight: 600; white-space: nowrap; }
.layout { display: grid; grid-template-columns: 1fr 360px; gap: 20px; max-width: 1200px; margin: 22px auto; padding: 0 20px; }
.panel { background: var(--panel); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
.step { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--brand); color: #fff; font-size: 0.8rem; }
.stores { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-bottom: 22px; }
.store { text-align: left; padding: 12px 14px; border-radius: 12px; cursor: pointer; border: 2px solid var(--line); background: #fff; font: inherit; color: inherit; transition: border-color 0.15s, transform 0.15s; }
.store:hover { transform: translateY(-1px); border-color: var(--brand); }
.store.selected { border-color: var(--brand); background: var(--brand-soft); }
.store strong { display: block; }
.store small { color: var(--muted); }
.store.closed { opacity: 0.65; }
.pill { display: inline-block; font-size: 0.75rem; padding: 1px 8px; border-radius: 999px; margin-top: 4px; }
.pill.open { background: var(--ok-soft); color: var(--ok); }
.pill.closed { background: var(--err-soft); color: var(--err); }
.menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.item { border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.item .emoji { font-size: 2rem; }
.item .price { font-weight: 700; color: var(--brand); font-size: 1.1rem; }
.item .row { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: auto; }
.item .recipe { font-size: 0.8rem; color: var(--muted); }
.link { background: none; border: 0; color: var(--muted); cursor: pointer; padding: 0; font: inherit; font-size: 0.8rem; text-decoration: underline; }
button.add, button.qty { border: 0; border-radius: 10px; cursor: pointer; font: inherit; font-weight: 600; background: var(--brand-soft); color: var(--brand); padding: 6px 12px; }
button.add:hover, button.qty:hover { background: var(--brand); color: #fff; }
button.qty { padding: 2px 9px; }
.cart { align-self: start; position: sticky; top: 16px; }
.cart-lines { list-style: none; margin: 0; padding: 0; }
.cart-lines li { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
.cart-lines .qtys { display: flex; align-items: center; gap: 6px; }
.cart-lines .warn { grid-column: 1 / -1; color: var(--err); font-size: 0.8rem; }
.cart-subtotal { display: flex; justify-content: space-between; padding: 12px 0 4px; font-size: 1.05rem; }
form { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; font-weight: 600; }
label small { font-weight: 400; color: var(--muted); }
input:not([type='radio']) { font: inherit; padding: 9px 11px; border: 1px solid var(--line); border-radius: 10px; background: #fffdfa; }
input:focus { outline: 2px solid var(--brand); outline-offset: 0; border-color: transparent; }
.toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.toggle label { font-weight: 500; }
.toggle input { position: absolute; opacity: 0; }
.toggle span { display: block; text-align: center; padding: 9px; border: 2px solid var(--line); border-radius: 10px; cursor: pointer; }
.toggle input:checked + span { border-color: var(--brand); background: var(--brand-soft); color: var(--brand); }
button.primary { border: 0; border-radius: 12px; padding: 13px; cursor: pointer; background: var(--brand); color: #fff; font: inherit; font-weight: 700; font-size: 1rem; }
button.primary:hover:not(:disabled) { filter: brightness(1.08); }
button.primary:disabled { opacity: 0.45; cursor: not-allowed; }
.result { margin-top: 16px; border-radius: 12px; padding: 14px; animation: pop 0.25s ease-out; }
.result.ok { background: var(--ok-soft); border: 1px solid #b2f2bb; }
.result.err { background: var(--err-soft); border: 1px solid #ffc9c9; color: var(--err); }
.result h3 { margin-bottom: 6px; }
.receipt { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.receipt td { padding: 2px 0; }
.receipt td:last-child { text-align: right; }
.receipt tr.total td { border-top: 1px solid #8ce99a; font-weight: 700; padding-top: 6px; }
@keyframes pop { from { transform: scale(0.97); opacity: 0; } }
.backstage { max-width: 1160px; margin: 0 auto 22px; border-top: 4px solid var(--accent); }
.backstage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.feed .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.state { font-size: 0.7rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
.state.done { background: var(--ok-soft); color: var(--ok); }
button.advance { border: 1px solid var(--accent); background: #fff; color: var(--accent); border-radius: 8px; font: inherit; font-size: 0.75rem; padding: 2px 8px; cursor: pointer; white-space: nowrap; }
button.advance:hover { background: var(--accent); color: #fff; }
.stock { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; font-size: 0.82rem; }
.stock li { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 3px 0; }
.stock .bar { grid-column: 1 / -1; height: 5px; border-radius: 3px; background: #f1ebe4; overflow: hidden; }
.stock .bar span { display: block; height: 100%; background: var(--ok); transition: width 0.3s; }
.stock li.low .bar span { background: var(--err); }
.stock li.low strong { color: var(--err); }
.promo-chips { display: flex; flex-wrap: wrap; gap: 6px; font-weight: 400; }
.promo-chip { border: 1px dashed var(--brand); background: var(--brand-soft); color: var(--brand); border-radius: 8px; font: inherit; font-size: 0.75rem; padding: 2px 8px; cursor: pointer; }
.tag { font-size: 0.7rem; font-weight: 500; background: #f1ebe4; color: var(--muted); padding: 1px 7px; border-radius: 999px; }
.feed { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; }
.feed li { padding: 6px 8px; border-radius: 8px; margin-bottom: 4px; background: #faf6f1; font-size: 0.85rem; }
.feed .status { font-weight: 700; margin-right: 6px; }
.feed .status.s2 { color: var(--ok); }
.feed .status.s4, .feed .status.s5 { color: var(--err); }
.architecture { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 18px; padding: 12px; background: var(--accent-soft); border-radius: 12px; }
.architecture .label { font-weight: 700; color: var(--accent); margin-right: 6px; }
.chip { padding: 5px 11px; border-radius: 999px; background: #fff; border: 1px solid var(--accent); color: var(--accent); font-size: 0.85rem; }
.chip.real { background: var(--accent); color: #fff; }
footer { text-align: center; color: var(--muted); font-size: 0.85rem; padding: 0 0 26px; }
footer a { color: var(--accent); }
@media (max-width: 1100px) { .backstage-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 860px) {
  .layout { grid-template-columns: 1fr; }
  .cart { position: static; }
  .backstage { margin: 0 20px 22px; }
  .backstage-grid { grid-template-columns: 1fr; }
  .topbar { padding: 14px 16px; flex-wrap: wrap; }
}
`;
}

// O ficheiro é ao mesmo tempo a biblioteca (para os testes) e o programa (npm start / demo / reset:db).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) SiliconSandwiches.main(process.argv.slice(2));
