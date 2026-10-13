#fcul

# Silicon Sandwiches · Layered · diagramas de arquitetura

Quatro vistas do código em `layered/`, na mesma ordem e com as mesmas cores de [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md), para as comparar lado a lado.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Layered.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual nas duas versões:

| Cor | Componente |
|---|---|
| 🟨 amarelo | CatalogCheckout |
| 🟦 azul | Location |
| 🩷 rosa | Promotion |
| 🟩 verde | ManageInventory |
| 🟧 laranja | MakeOrder |
| 🟪 roxo | Delivery |
| 🩵 ciano | Recipes |
| ⬜ cinzento | técnico / partilhado |

---

## 1 · Particionamento de topo

O primeiro corte é **técnico**: as pastas de topo são camadas. Cada cor atravessa as quatro camadas. O checkout, por exemplo, está em `checkoutController`, em três serviços, em dois repositórios e no `schema.sql` comum.

```mermaid
flowchart TB
  subgraph P["presentation/"]
    direction LR
    p1["checkoutController"]:::cc
    p2["locationController"]:::loc
    p3["promotionController"]:::promo
    p4["inventoryController"]:::inv
    p5["makeOrderController"]:::mo
    p6["deliveryController"]:::del
    p7["recipeController"]:::rec
    p8["webController · http.js · web/"]:::tech
  end
  subgraph B["business/"]
    direction LR
    b1["checkoutService"]:::cc
    b2["catalogService"]:::cc
    b3["paymentService<br/>(gateway simulado)"]:::cc
    b4["locationService"]:::loc
    b5["promotionService"]:::promo
    b6["inventoryService"]:::inv
    b7["makeOrderService"]:::mo
    b8["deliveryService"]:::del
    b9["recipeService"]:::rec
    b10["errors.js · mockLog.js"]:::tech
  end
  subgraph R["persistence/"]
    direction LR
    r1["orderRepository"]:::cc
    r2["catalogRepository"]:::cc
    r3["storeRepository"]:::loc
    r4["promotionRepository"]:::promo
    r5["stockRepository"]:::inv
    r6["kitchenRepository"]:::mo
    r7["deliveryRepository"]:::del
    r8["recipeRepository"]:::rec
    r9["db.js"]:::tech
  end
  subgraph D["database/"]
    direction LR
    d1["schema.sql<br/>um só esquema com as 15 tabelas de todos os componentes"]:::tech
    d2["seed.sql"]:::tech
  end
  P --> B --> R --> D

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

Fora das camadas ficam `app.js` (a raiz de composição, que cria e liga tudo) e `server.js`.

> **Perguntar:** "Quero mudar a forma como se calcula a taxa de entrega e guardar mais um campo. Quantas pastas abro?" → Pelo menos três: `business/deliveryService.js`, `persistence/deliveryRepository.js` e `database/schema.sql`. Se a taxa aparecer no ecrã, também `presentation/`.

---

## 2 · Regras de dependência

As camadas são **fechadas**: cada camada só pode usar a própria e a imediatamente abaixo. É isto que `scripts/check-layers.js` verifica (`npm run check:arch`).

```mermaid
flowchart TB
  P["presentation<br/>controllers · http.js · web/"]
  B["business<br/>serviços · errors.js"]
  R["persistence<br/>repositórios · db.js"]
  D[("database<br/>schema.sql · SQLite")]
  P -->|"✔ pode usar"| B
  B -->|"✔ pode usar"| R
  R -->|"✔ SQL"| D
  P -.-x|"✘ saltar a camada"| R
  B -.-x|"✘ para cima"| P
  R -.-x|"✘ para cima"| B

  linkStyle 0,1,2 stroke:#15803D,stroke-width:2px
  linkStyle 3,4,5 stroke:#B91C1C,stroke-width:2px
```

| Camada | Pode importar de |
|---|---|
| `presentation` | `presentation`, `business` |
| `business` | `business`, `persistence` |
| `persistence` | `persistence` |

Um exemplo de violação: `checkoutController.js` importar `../persistence/orderRepository.js`.

`app.js` fica **fora** das camadas. Cria os repositórios, os serviços e os *controllers*, e injeta cada um no de cima. Os *controllers* recebem os serviços; não os importam.

> **Perguntar:** "O `checkoutService` chama o `inventoryService`. É uma violação?" → Não. É uma dependência dentro da mesma camada, e a regra permite-a. Mas é também por aqui que os componentes se acoplam sem que a regra das camadas dê por isso.

---

## 3 · Sequência do checkout

`POST /checkout` desce camada a camada. O `checkoutService` orquestra os outros serviços de negócio e chama-os diretamente. Todos os repositórios vão ao mesmo esquema.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  box rgba(128,128,128,0.12) presentation
    participant CC as checkoutController
  end
  box rgba(128,128,128,0.12) business
    participant CS as checkoutService
    participant CAT as catalogService
    participant LS as locationService
    participant PS as promotionService
    participant DS as deliveryService
    participant IS as inventoryService
    participant RS as recipeService
    participant PAY as paymentService
    participant MO as makeOrderService
  end
  box rgba(128,128,128,0.12) persistence
    participant REP as repositórios (8)
  end
  box rgba(128,128,128,0.12) database
    participant DB as SQLite · schema.sql único
  end

  C->>CC: POST /checkout
  CC->>CS: checkout(body)
  CS->>LS: getStore(storeId)
  LS->>REP: storeRepository
  CS->>CAT: menuFor(storeId)
  CAT->>REP: catalogRepository
  opt há código promocional
    CS->>PS: discountFor(…)
    PS->>REP: promotionRepository
  end
  opt entrega ao domicílio
    CS->>DS: quote(store, address)
    DS->>REP: deliveryRepository
  end
  CS->>IS: reserve(storeId, lines)
  IS->>RS: get(sandwichId)
  RS->>REP: recipeRepository
  IS->>REP: stockRepository.reserve
  CS->>PAY: charge(customerId, total)
  Note over PAY: gateway externo (simulado)
  alt pagamento recusado
    CS->>IS: release(reservationId)
    CS-->>CC: PaymentDeclinedError
  else pagamento aprovado
    CS->>REP: orderRepository.create
    REP->>DB: INSERT (uma transação)
    CS->>PS: redeem(…) se houver código
    CS->>MO: enqueue(order)
    MO->>REP: kitchenRepository
    CS->>DS: schedule(…) se for entrega
    DS->>REP: deliveryRepository
    CS-->>CC: order
    CC-->>C: 201 Created
  end
  Note over REP,DB: os 8 repositórios partilham db.js e o mesmo schema.sql
```

> **Perguntar:** "Comparem com a mesma sequência no Modular. Os passos mudam?" → Não: a sequência é a mesma. Muda **onde** está o código e **o que** o checkout consegue ver. Aqui, o `checkoutService` tem acesso a todos os serviços e, através deles, a todas as tabelas.

---

## 4 · Dados

Há um só `database/schema.sql`, com 15 tabelas e 18 chaves estrangeiras. **12 delas ligam tabelas de componentes diferentes** (a vermelho). Qualquer repositório pode fazer `JOIN` com qualquer tabela. As contagens são minhas, feitas a partir do `schema.sql`.

```mermaid
flowchart LR
  subgraph S["database/schema.sql"]
    sandwich:::cc
    store_menu:::cc
    customer_order:::cc
    order_line:::cc
    store:::loc
    recipe_ingredient:::rec
    stock_level:::inv
    stock_reservation:::inv
    stock_reservation_line:::inv
    promotion_code:::promo
    promotion_redemption:::promo
    kitchen_ticket:::mo
    kitchen_ticket_item:::mo
    delivery_zone:::del
    delivery_job:::del
  end

  %% FK dentro do mesmo componente (0–5)
  store_menu --> sandwich
  order_line --> customer_order
  order_line --> sandwich
  stock_reservation_line --> stock_reservation
  promotion_redemption --> promotion_code
  kitchen_ticket_item --> kitchen_ticket

  %% FK entre componentes (6–17)
  store_menu --> store
  customer_order --> store
  recipe_ingredient --> sandwich
  stock_level --> store
  stock_reservation --> store
  promotion_code --> store
  promotion_redemption --> customer_order
  kitchen_ticket --> customer_order
  kitchen_ticket --> store
  delivery_zone --> store
  delivery_job --> customer_order
  delivery_job --> store

  linkStyle 6,7,8,9,10,11,12,13,14,15,16,17 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
```

> **Perguntar:** "Amanhã queremos tirar o Delivery para um serviço à parte. O que se parte na base de dados?" → As FK `delivery_job → customer_order` e `delivery_job → store`, e também `delivery_zone → store`. Separar o código é a parte fácil; separar os dados é a difícil.
