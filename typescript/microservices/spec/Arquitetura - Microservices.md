#fcul

# Silicon Sandwiches · Microservices · diagramas de arquitetura

Quatro vistas do código em `microservices/`, na mesma ordem e com as mesmas cores de [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md) e [Arquitetura - Service-Based](../../service-based/spec/Arquitetura%20-%20Service-Based.md), para as comparar lado a lado. O código de cada serviço vem do módulo correspondente do `modular/`.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Microservices.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual em todas as versões. Aqui, cada cor é um serviço:

| Cor | Componente | Serviço |
|---|---|---|
| 🟨 amarelo | CatalogCheckout | `services/checkout/` · :3201 |
| 🟦 azul | Location | `services/location/` · :3202 |
| 🩷 rosa | Promotion | `services/promotion/` · :3203 |
| 🟩 verde | ManageInventory | `services/inventory/` · :3204 |
| 🩵 ciano | Recipes | `services/recipes/` · :3205 |
| 🟧 laranja | MakeOrder | `services/kitchen/` · :3206 |
| 🟪 roxo | Delivery | `services/delivery/` · :3207 |
| ⬜ cinzento | técnico / partilhado | `gateway/` · :3200 e `platform/` |

---

## 1 · Particionamento de topo

O corte é **um serviço por componente do kata**. Cada serviço corre no seu processo, tem a sua `api/` HTTP, o seu `business/` e o seu `persistence/`, e é dono da sua **base de dados** (*database-per-service*). Os clientes só entram pelo **gateway**, que também serve a interface. `platform/` faz o papel do *sidecar*: o que é operacional e igual em todos os serviços, sem código de domínio.

```mermaid
flowchart LR
  gw["gateway/ · API gateway + interface · :3200<br/>só encaminha; não expõe /api/… nem /events/…"]:::tech

  subgraph SV["services/ · 7 microsserviços, cada um com o seu processo e a sua base de dados"]
    ck["checkout · :3201<br/>api · business · persistence<br/>clients.ts · eventPublisher"]:::cc
    lo["location · :3202<br/>api · business · persistence"]:::loc
    pr["promotion · :3203<br/>api · business · persistence"]:::promo
    in["inventory · :3204<br/>api · business · persistence"]:::inv
    re["recipes · :3205<br/>api · business · persistence"]:::rec
    ki["kitchen · :3206<br/>api · business · persistence"]:::mo
    de["delivery · :3207<br/>api · business · persistence"]:::del
    ckdb[("checkout.db<br/>+ checkout_outbox")]:::cc
    lodb[("location.db")]:::loc
    prdb[("promotion.db")]:::promo
    indb[("inventory.db")]:::inv
    redb[("recipes.db")]:::rec
    kidb[("kitchen.db")]:::mo
    dedb[("delivery.db")]:::del
  end

  plat["platform/ · o papel do sidecar<br/>router HTTP · serviceClient (tempo limite,<br/>registo das chamadas) · db.ts · erros → HTTP"]:::tech

  gw -->|HTTP| ck & lo & pr & in & re & ki & de
  ck --> ckdb
  lo --> lodb
  pr --> prdb
  in --> indb
  re --> redb
  ki --> kidb
  de --> dedb
  SV -.->|todos usam| plat

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

Nenhum serviço importa código de outro. O que cada um precisa de saber dos outros vem pela rede, só com os campos necessários: o evento `OrderPlaced`, por exemplo, leva os nomes das sandes, para a cozinha não ter de perguntar ao Checkout. Duplica-se em vez de partilhar.

> **Perguntar:** "No `service-based/` havia quatro serviços e uma base de dados. Aqui há sete e sete. O que se ganhou?" → Cada serviço implanta-se, escala e falha à parte, e muda o seu esquema sem pedir licença a ninguém. O preço vê-se nas vistas seguintes: pedidos de rede em cada checkout, compensações em vez de `ROLLBACK`, um *outbox* e consumidores idempotentes.

---

## 2 · Regras de dependência

Não há imports entre serviços: o acoplamento é **dinâmico**, pela rede. O Checkout chama quatro serviços por HTTP, de forma síncrona (saga orquestrada pelo próprio Checkout), e no fim publica o evento `OrderPlaced`, a que três serviços reagem por si (coreografia). O mapa é o que o `check:arch` mostra no fim, lido dos clientes HTTP de cada serviço.

```mermaid
flowchart LR
  gw["gateway"]:::tech
  ck["checkout"]:::cc
  lo["location"]:::loc
  pr["promotion"]:::promo
  de["delivery"]:::del
  in["inventory"]:::inv
  re["recipes"]:::rec
  ki["kitchen"]:::mo

  gw -->|"rotas públicas"| ck
  ck -->|"GET /api/stores/:id"| lo
  ck -->|"POST /api/discounts"| pr
  ck -->|"POST /api/quotes"| de
  ck -->|"POST /api/reservations · …/release"| in
  in -->|"GET /recipes/:id"| re
  ck -.->|"OrderPlaced"| pr
  ck -.->|"OrderPlaced"| ki
  ck -.->|"OrderPlaced"| de

  subgraph X["✘ o que o check:arch rejeita"]
    direction TB
    x1["services/checkout/src/…"]:::cc
    x2["services/inventory/src/…"]:::inv
    x3["platform/…"]:::tech
    x4["services/…"]:::tech
    x5["services/kitchen (SQL)"]:::mo
    x6["tabela checkout_customer_order"]:::cc
    x7["gateway/ (SQL)"]:::tech
    x8["qualquer tabela"]:::tech
  end
  x1 -.-x|"regra 1 · importar código de outro serviço"| x2
  x3 -.-x|"regra 2 · a plataforma importa um serviço"| x4
  x5 -.-x|"regra 3 · tabela de outro serviço"| x6
  x7 -.-x|"regra 4 · o gateway não tem SQL"| x8

  linkStyle 1,2,3,4,5 stroke:#1D4ED8,stroke-width:2px
  linkStyle 6,7,8 stroke:#6D28D9,stroke-width:2px
  linkStyle 9,10,11,12 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

O gateway encaminha também as outras rotas públicas para o serviço dono de cada uma (lojas, stock, receitas, cozinha, entregas); não estão desenhadas.

As quatro regras de `scripts/check-architecture.ts` (`npm run check:arch`):

1. Um serviço não importa código de outro serviço: só o seu e o de `platform/`.
2. A plataforma e o gateway não importam código de nenhum serviço.
3. Cada serviço só usa as tabelas do seu `schema.sql`.
4. O gateway não tem SQL.

> **Perguntar:** "Que serviços são críticos para vender?" → Os que estão nas setas azuis: Location, Promotion, Delivery, Inventory e Recipes. Se um deles não responder, o checkout falha com 503. Os das setas roxas (Kitchen, Delivery, Promotion, como subscritores) podem estar em baixo: o evento espera no *outbox*.

---

## 3 · Sequência do checkout

Os mesmos oito passos de sempre, mas cada passo é agora um pedido HTTP a outro serviço, com a sua base de dados. **Passos 1 a 6: orquestração.** Como não há uma transação que abranja os serviços, um pagamento recusado obriga a uma **transação de compensação** no Inventory (*Saga*). **Passos 7 e 8: *outbox* e coreografia.** A encomenda e o evento são gravados na mesma transação local; depois o evento é enviado aos subscritores, que reagem por si.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  participant GW as gateway
  box rgba(253,230,138,0.35) checkout · :3201
    participant CK as checkoutApi → checkoutService
    participant CDB as checkout.db · outbox
  end
  participant LO as location
  participant PR as promotion
  participant DE as delivery
  participant IN as inventory
  participant RE as recipes
  participant KI as kitchen

  C->>GW: POST /checkout
  GW->>CK: POST /checkout
  CK->>LO: GET /api/stores/:id
  LO-->>CK: { id, name, open }
  CK->>CDB: menuFor (checkout_sandwich · checkout_store_menu)
  opt há código promocional
    CK->>PR: POST /api/discounts
    PR-->>CK: { valid, discountCents }
  end
  opt entrega ao domicílio
    CK->>DE: POST /api/quotes { store: { id, name } }
    DE-->>CK: { available, feeCents }
  end
  CK->>IN: POST /api/reservations { storeId, lines }
  loop por sandes
    IN->>RE: GET /recipes/:id
  end
  IN-->>CK: { ok, reservationId }
  CK->>CK: payment.charge (gateway simulado)
  alt pagamento recusado
    CK->>IN: POST /api/reservations/:id/release (compensação)
    CK-->>GW: 402
    GW-->>C: 402
  else pagamento aprovado
    CK->>CDB: INSERT checkout_* + checkout_outbox (uma transação local)
    par evento OrderPlaced
      CK-)PR: POST /events/order-placed → regista o código usado
    and
      CK-)KI: POST /events/order-placed → cria o bilhete
    and
      CK-)DE: POST /events/order-placed → agenda a entrega
    end
    CK->>CDB: markDispatched (só se todos receberam)
    CK-->>GW: 201
    GW-->>C: 201 Created
  end
  Note over CK,KI: se um subscritor estiver em baixo, o evento fica no outbox e volta a ser enviado de 2 em 2 s. Os consumidores são idempotentes (order_id UNIQUE)
```

> **Perguntar:** "Quantos pedidos de rede faz um checkout com entrega, promoção e duas sandes diferentes?" → Do Checkout: Location, Promotion, Delivery e Inventory (4); do Inventory ao Recipes, um por sandes (2); o evento para três subscritores (3); mais a entrada pelo gateway. Pelo menos dez, contra zero entre serviços no `service-based/`. `npm run demo` mostra-os todos nas linhas `[http]`.

---

## 4 · Dados

**Sete bases de dados**, uma por serviço, com as mesmas 15 tabelas do `modular/` mais o `checkout_outbox` (16). As 6 chaves estrangeiras ficam dentro de cada serviço. As 12 referências entre componentes atravessam agora bases de dados: são ids guardados, que nenhuma consulta pode verificar (a vermelho). As contagens são minhas, feitas a partir dos `schema.sql`.

```mermaid
flowchart LR
  subgraph CK["checkout.db"]
    checkout_sandwich:::cc
    checkout_store_menu:::cc
    checkout_customer_order:::cc
    checkout_order_line:::cc
    checkout_outbox:::cc
  end
  subgraph LO["location.db"]
    location_store:::loc
  end
  subgraph PR["promotion.db"]
    promotion_code:::promo
    promotion_redemption:::promo
  end
  subgraph IN["inventory.db"]
    inventory_stock_level:::inv
    inventory_stock_reservation:::inv
    inventory_stock_reservation_line:::inv
  end
  subgraph RE["recipes.db"]
    recipe_ingredient:::rec
  end
  subgraph KI["kitchen.db"]
    kitchen_ticket:::mo
    kitchen_ticket_item:::mo
  end
  subgraph DE["delivery.db"]
    delivery_zone:::del
    delivery_job:::del
  end

  %% FK dentro do serviço (0–5)
  checkout_store_menu --> checkout_sandwich
  checkout_order_line --> checkout_customer_order
  checkout_order_line --> checkout_sandwich
  promotion_redemption --> promotion_code
  inventory_stock_reservation_line --> inventory_stock_reservation
  kitchen_ticket_item --> kitchen_ticket

  %% id noutra base de dados (6–17)
  checkout_store_menu -.-> location_store
  checkout_customer_order -.-> location_store
  promotion_code -.-> location_store
  promotion_redemption -.-> checkout_customer_order
  recipe_ingredient -.-> checkout_sandwich
  inventory_stock_level -.-> location_store
  inventory_stock_reservation -.-> location_store
  kitchen_ticket -.-> checkout_customer_order
  kitchen_ticket -.-> location_store
  delivery_zone -.-> location_store
  delivery_job -.-> checkout_customer_order
  delivery_job -.-> location_store

  linkStyle 6,7,8,9,10,11,12,13,14,15,16,17 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
```

| | Modular | Service-Based | Microservices |
|---|---|---|---|
| Bases de dados | 1 | 1, com 5 partições | 7 |
| Tabelas | 15 | 15 | 16 (+ `checkout_outbox`) |
| Chaves estrangeiras | 6 | 6 | 6 |
| Referências que atravessam bases de dados | 0 | 0 | 12 |
| Pagamento recusado | compensação (`release`) | `ROLLBACK` | compensação por HTTP |

> **Perguntar:** "O `BEMVINDO` só pode ser usado uma vez por cliente, mas a utilização só é registada quando o `OrderPlaced` chega ao Promotion. O mesmo cliente consegue usá-lo duas vezes?" → Sim, se fizer o segundo checkout antes de o evento do primeiro chegar (por exemplo, com o Promotion lento ou em baixo). É o custo da consistência eventual. No `service-based/`, a utilização é gravada na mesma transação da encomenda.
