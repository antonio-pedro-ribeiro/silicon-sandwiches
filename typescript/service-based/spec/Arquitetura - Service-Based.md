#fcul

# Silicon Sandwiches · Service-Based · diagramas de arquitetura

Quatro vistas do código em `service-based/`, na mesma ordem e com as mesmas cores de [Arquitetura - Layered](../../layered/spec/Arquitetura%20-%20Layered.md) e [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md), para as comparar lado a lado.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Service-Based.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual em todas as versões:

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

Aqui os serviços têm várias cores: um serviço de domínio de grão grosso junta vários componentes do kata.

---

## 1 · Particionamento de topo

O primeiro corte é por **serviços de domínio de grão grosso**: quatro, cada um implantado à parte, mais uma interface que é também o API gateway. Por dentro, cada serviço é uma pequena arquitetura em camadas (`api/` → `business/` → bibliotecas de entidades). Todos usam **uma só base de dados**, dividida em cinco partições lógicas, com uma biblioteca de entidades por partição.

```mermaid
flowchart TB
  ui["ui/ · interface + API gateway · :3100<br/>encaminha cada rota; round-robin entre instâncias"]:::tech

  subgraph S["services/ · 4 serviços de domínio, implantados à parte"]
    direction LR
    subgraph OR["orders · :3101 e :3111 (2 instâncias)"]
      direction TB
      or0["api/ordersApi"]:::tech
      or1["catalogService · checkoutService<br/>paymentService (gateway simulado)"]:::cc
      or2["promotionService"]:::promo
    end
    subgraph STO["stores · :3102"]
      direction TB
      st0["api/storesApi"]:::tech
      st1["locationService"]:::loc
      st2["inventoryService"]:::inv
      st3["recipeService"]:::rec
    end
    subgraph KI["kitchen · :3103"]
      direction TB
      ki0["api/kitchenApi"]:::tech
      ki1["makeOrderService"]:::mo
    end
    subgraph DE["delivery · :3104"]
      direction TB
      de0["api/deliveryApi"]:::tech
      de1["deliveryService"]:::del
    end
  end

  subgraph L["libs/ · bibliotecas partilhadas (em produção, pacotes com versão)"]
    direction LR
    l1["common-entities<br/>storeRepository"]:::loc
    l2["orders-entities<br/>catalog · order · promotionRepository"]:::cc
    l3["inventory-entities<br/>stock · recipeRepository"]:::inv
    l4["kitchen-entities<br/>kitchenRepository"]:::mo
    l5["delivery-entities<br/>deliveryRepository"]:::del
    l6["platform<br/>http · db · errors · mockLog"]:::tech
  end

  db[("database/ · UMA base de dados partilhada<br/>5 partições: common · orders · inventory · kitchen · delivery<br/>15 tabelas · setup.ts (gerida à parte dos serviços)")]:::tech

  ui -->|HTTP| S
  S --> L
  L --> db

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

| Serviço | Componentes do kata | Porta |
|---|---|---|
| Orders | CatalogCheckout, Promotion (+ gateway de pagamento simulado) | 3101 e 3111 |
| Stores | Location, ManageInventory, Recipes | 3102 |
| Kitchen | MakeOrder | 3103 |
| Delivery | Delivery | 3104 |
| `ui/` | interface + API gateway | 3100 |

> **Perguntar:** "No `modular/` havia sete módulos; aqui há quatro serviços. O que decidiu os agrupamentos?" → O que muda e escala junto. O checkout e as promoções andam sempre juntos (Orders); a loja, o seu stock e as receitas também (Stores). A cozinha e as entregas têm utilizadores e ritmos próprios, e ficaram sozinhas.

---

## 2 · Regras de dependência

Os serviços **não se chamam uns aos outros** nem importam código uns dos outros: integram-se **pela base de dados**. Só importam as bibliotecas de `libs/`, e só as bibliotecas de entidades têm SQL, cada uma na sua partição. O Orders importa as cinco bibliotecas de entidades, porque o checkout mexe em todas as partições.

```mermaid
flowchart LR
  subgraph SV["services/"]
    direction TB
    orders["orders"]:::cc
    stores["stores"]:::loc
    kitchen["kitchen"]:::mo
    delivery["delivery"]:::del
  end
  subgraph LB["libs/ · bibliotecas de entidades"]
    direction TB
    common["common-entities"]:::loc
    ordersE["orders-entities"]:::cc
    invE["inventory-entities"]:::inv
    kitE["kitchen-entities"]:::mo
    delE["delivery-entities"]:::del
  end
  subgraph DB["base de dados · partições"]
    direction TB
    pCommon["common"]:::loc
    pOrders["orders"]:::cc
    pInv["inventory"]:::inv
    pKit["kitchen"]:::mo
    pDel["delivery"]:::del
  end

  orders --> common & ordersE & invE & kitE & delE
  stores --> common & invE
  kitchen --> kitE
  delivery --> delE
  common --> pCommon
  ordersE --> pOrders
  invE --> pInv
  kitE --> pKit
  delE --> pDel

  subgraph X["✘ o que o check:arch rejeita"]
    direction TB
    x1["services/orders"]:::cc
    x2["services/kitchen · HTTP"]:::mo
    x3["services/kitchen/…"]:::mo
    x4["services/orders/src/…"]:::cc
    x5["kitchen-entities"]:::mo
    x6["tabela checkout_customer_order"]:::cc
  end
  x1 -.-x|"regra 3 · pedido HTTP a outro serviço"| x2
  x3 -.-x|"regra 2 · importar código de outro serviço"| x4
  x5 -.-x|"regra 4 · tabela de outra partição"| x6

  linkStyle 0,1,2,3,4,5,6,7,8,9,10,11,12,13 stroke:#15803D,stroke-width:2px
  linkStyle 14,15,16 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
```

As cinco regras de `scripts/check-architecture.ts` (`npm run check:arch`):

1. No máximo 12 serviços de domínio.
2. Um serviço (ou a interface) não importa código de outro serviço: só o seu e o de `libs/`.
3. Um serviço não faz pedidos HTTP a outro: a integração faz-se pela base de dados.
4. Só as bibliotecas de entidades têm SQL, e cada uma só usa as tabelas da sua partição.
5. Uma biblioteca só importa `libs/platform`.

Todos os serviços e a `ui/` importam também `libs/platform` (não desenhado). O `check:arch` termina com a **matriz de impacto**, que é o diagrama acima lido ao contrário:

| Se mudar a biblioteca… | é preciso testar e reimplantar |
|---|---|
| `common-entities` | orders, stores |
| `delivery-entities` | delivery, orders |
| `inventory-entities` | orders, stores |
| `kitchen-entities` | kitchen, orders |
| `orders-entities` | orders |
| `platform` | delivery, kitchen, orders, stores, ui |

> **Perguntar:** "Acrescenta-se uma coluna a `kitchen_ticket` (a nota "sem cebola"). Que serviços se reimplantam? E se fosse em `location_store`?" → `kitchen_ticket` está na partição *kitchen*: reimplantam-se o Kitchen e o Orders, que importam `kitchen-entities`. `location_store` está na partição *common*: o Orders e o Stores. O Orders aparece em todas as linhas da matriz.

---

## 3 · Sequência do checkout

`POST /checkout` entra pelo gateway, que escolhe uma das duas instâncias do Orders. O Orders **não chama nenhum outro serviço**: lê e escreve as tabelas de que precisa pelas bibliotecas de entidades. Os passos 5 a 8 são **uma só transação ACID**: se o pagamento for recusado, `ROLLBACK` e não fica nada a meio. Não há compensação.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  participant GW as ui · API gateway
  box rgba(253,230,138,0.35) serviço orders · :3101 ou :3111
    participant CS as ordersApi → checkoutService
    participant PS as catalog · promotionService
  end
  box rgba(128,128,128,0.12) libs/ · bibliotecas de entidades
    participant COM as common-entities
    participant ORD as orders-entities
    participant INV as inventory-entities
    participant KIT as kitchen-entities
    participant DEL as delivery-entities
  end
  participant DB as BD partilhada
  participant K as serviço kitchen · :3103

  C->>GW: POST /checkout
  GW->>CS: POST /checkout (round-robin entre instâncias)
  CS->>COM: stores.findById → location_store
  CS->>PS: menuFor(storeId)
  PS->>ORD: checkout_sandwich · checkout_store_menu
  opt há código promocional
    CS->>PS: discountFor(…)
    PS->>ORD: promotion_code · promotion_redemption
  end
  opt entrega ao domicílio
    CS->>DEL: deliveries.findZone → delivery_zone
  end
  CS->>DB: BEGIN
  CS->>INV: recipes.findBySandwich · stock.reserve
  CS->>CS: payment.charge (gateway simulado, dentro da transação)
  alt pagamento recusado
    CS->>DB: ROLLBACK (o stock volta sozinho)
    CS-->>GW: 402
    GW-->>C: 402
  else pagamento aprovado
    CS->>ORD: orders.create · promotions.addRedemption
    CS->>KIT: kitchen.create → kitchen_ticket
    CS->>DEL: deliveries.create → delivery_job (se for entrega)
    CS->>DB: COMMIT
    CS-->>GW: 201
    GW-->>C: 201 Created
  end
  Note over KIT,K: mais tarde, sem ninguém o avisar: GET /kitchen/queue
  K->>KIT: kitchenRepository.findAll(storeId)
```

> **Perguntar:** "A cozinha está em baixo. O checkout funciona?" → Sim. O Orders escreve o bilhete diretamente na tabela `kitchen_ticket`; quando o Kitchen volta, os bilhetes estão lá. O preço desta independência é o acoplamento pelos dados: o Orders tem de conhecer as tabelas da cozinha e das entregas.

---

## 4 · Dados

Uma só base de dados física com as **mesmas 15 tabelas e as mesmas 6 chaves estrangeiras do `modular/`**, repartidas por **cinco partições lógicas**, cada uma com o seu `schema.sql` em `database/<partição>/` e a sua biblioteca de entidades. As FK ficam dentro de cada partição; as 12 referências entre partições são ids guardados, sem FK (a tracejado). As contagens são minhas, feitas a partir dos `schema.sql`.

```mermaid
flowchart LR
  subgraph PO["partição orders · orders-entities"]
    checkout_sandwich:::cc
    checkout_store_menu:::cc
    checkout_customer_order:::cc
    checkout_order_line:::cc
    promotion_code:::promo
    promotion_redemption:::promo
  end
  subgraph PC["partição common · common-entities"]
    location_store:::loc
  end
  subgraph PI["partição inventory · inventory-entities"]
    inventory_stock_level:::inv
    inventory_stock_reservation:::inv
    inventory_stock_reservation_line:::inv
    recipe_ingredient:::rec
  end
  subgraph PK["partição kitchen · kitchen-entities"]
    kitchen_ticket:::mo
    kitchen_ticket_item:::mo
  end
  subgraph PD["partição delivery · delivery-entities"]
    delivery_zone:::del
    delivery_job:::del
  end

  %% FK dentro da partição (0–5)
  checkout_store_menu --> checkout_sandwich
  checkout_order_line --> checkout_customer_order
  checkout_order_line --> checkout_sandwich
  promotion_redemption --> promotion_code
  inventory_stock_reservation_line --> inventory_stock_reservation
  kitchen_ticket_item --> kitchen_ticket

  %% id de outra partição, sem FK (6–17)
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

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
```

Uma partição não é um componente: `recipe_ingredient` (Recipes) está na partição *inventory* e `promotion_*` (Promotion) na partição *orders*, porque andam com o serviço que as usa.

> **Perguntar:** "Quantos *quanta* tem este sistema? E se o Delivery passasse a ter a sua própria base de dados?" → Um: os quatro serviços dependem da mesma base de dados, e sem ela nada funciona. Com uma base de dados própria, o Delivery podia ser um segundo *quantum*, mas só se o Orders deixasse de escrever em `delivery_job` dentro da sua transação. Para isso teria de passar a chamá-lo (ou a avisá-lo), como no `microservices/`.
