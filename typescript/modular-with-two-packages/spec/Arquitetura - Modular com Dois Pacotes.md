#fcul

# Silicon Sandwiches · Modular com dois pacotes de deployment · diagramas de arquitetura

Quatro vistas do código em `modular-with-two-packages/`, na mesma ordem e com as mesmas cores de [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md), para as comparar lado a lado. O código é o do `modular/`; muda só onde corre o Delivery.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Modular com Dois Pacotes.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual em todas as versões:

| Cor | Componente / módulo |
|---|---|
| 🟨 amarelo | CatalogCheckout · `catalogcheckout/` |
| 🟦 azul | Location · `location/` |
| 🩷 rosa | Promotion · `promotion/` |
| 🟩 verde | ManageInventory · `manageinventory/` |
| 🟧 laranja | MakeOrder · `makeorder/` |
| 🟪 roxo | Delivery · `delivery/` (a tracejado: o cliente HTTP que o substitui no pacote 1) |
| 🩵 ciano | Recipes · `recipes/` |
| ⬜ cinzento | técnico / partilhado |

---

## 1 · Particionamento de topo

O corte continua a ser **por domínio**, como no `modular/`, mas agora há um segundo nível acima dos módulos: **dois pacotes de deployment**. Cada um tem o seu `package.json`, o seu processo, a sua base de dados e a sua cópia de `shared/`. A pasta de topo (`scripts/` start-all · demo · check-deployments e `test/system.test.ts`) só junta o desenvolvimento e não é implantada.

```mermaid
flowchart TB
  subgraph P1["pacote 1 · packages/sandwiches/ · processo :3003"]
    direction TB
    app1["app.ts · server.ts · raiz de composição (recebe deliveryUrl)"]:::tech
    subgraph M1["src/modules/ · iguais aos do modular/"]
      direction LR
      cc["catalogcheckout/"]:::cc
      loc["location/"]:::loc
      promo["promotion/"]:::promo
      inv["manageinventory/"]:::inv
      mo["makeorder/"]:::mo
      rec["recipes/"]:::rec
      delc["delivery/index.ts<br/>cliente HTTP,<br/>a mesma API pública"]:::delc
    end
    sh1["shared/ · http.ts (+503) · db.ts · errors.ts (+ServiceUnavailableError) · mockLog.ts"]:::tech
    web["web/ · interface (tolera o Delivery em baixo)"]:::tech
    db1[("data/silicon-sandwiches.db<br/>13 tabelas")]:::tech
  end

  subgraph P2["pacote 2 · packages/delivery/ · processo :3004"]
    direction TB
    app2["app.ts · server.ts"]:::tech
    pub["publicApi.ts<br/>POST /api/quotes · POST /api/deliveries"]:::del
    del["modules/delivery/<br/>o módulo do modular/, sem alterações"]:::del
    sh2["shared/ · cópia de http.ts · db.ts · errors.ts"]:::tech
    db2[("data/delivery.db<br/>2 tabelas")]:::tech
  end

  app1 --> M1
  app1 --> web
  M1 --> sh1
  M1 --> db1
  delc -->|"HTTP · timeout 2 s"| pub
  app2 --> pub
  pub --> del
  del --> sh2
  del --> db2

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef delc fill:#FFFFFF,stroke:#6D28D9,stroke-dasharray:5 4,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

| Pacote | Módulos | Base de dados | Porta |
|---|---|---|---|
| 1 · sandwiches | CatalogCheckout, Location, ManageInventory, Promotion, MakeOrder, Recipes + interface web | `packages/sandwiches/data/silicon-sandwiches.db` | 3003 |
| 2 · delivery | Delivery | `packages/delivery/data/delivery.db` | 3004 |

> **Perguntar:** "Quantos ficheiros do `modular/` mudaram para tirar o Delivery?" → Só a raiz de composição (`app.ts`, que passa a receber o `deliveryUrl`) e o `index.ts` do módulo Delivery no pacote 1, que passou a ser um cliente HTTP. O CatalogCheckout e o próprio módulo Delivery não mudaram. O que se acrescentou foi à volta: `publicApi.ts`, o `503` e a cópia de `shared/`.

---

## 2 · Regras de dependência

Há dois níveis de regras. **Entre pacotes**, nenhum importa código do outro: só falam por HTTP (`scripts/check-deployments.ts`). **Dentro do pacote sandwiches**, as três regras do `modular/` (`packages/sandwiches/scripts/check-modules.ts`). O CatalogCheckout continua a receber um `delivery` com `quote` e `schedule`; não sabe que do outro lado há uma rede.

```mermaid
flowchart TB
  subgraph P1["pacote sandwiches"]
    cc["catalogcheckout<br/>index.ts"]:::cc
    loc["location<br/>index.ts"]:::loc
    promo["promotion<br/>index.ts"]:::promo
    inv["manageinventory<br/>index.ts"]:::inv
    mo["makeorder<br/>index.ts"]:::mo
    rec["recipes<br/>index.ts"]:::rec
    delc["delivery/index.ts<br/>cliente HTTP"]:::delc
  end
  subgraph P2["pacote delivery"]
    pub["publicApi.ts"]:::del
    del["modules/delivery<br/>index.ts"]:::del
  end

  cc -->|getStore| loc
  cc -->|"discountFor · redeem"| promo
  cc -->|"reserve · release"| inv
  cc -->|enqueue| mo
  cc -->|"quote · schedule"| delc
  inv -->|get| rec
  delc ==>|"POST /api/quotes · POST /api/deliveries"| pub
  pub -->|"quote · schedule"| del

  subgraph X["✘ o que o check:arch rejeita"]
    direction LR
    x1["packages/sandwiches/src/…"]:::tech
    x2["packages/delivery/src/modules/<br/>delivery/business/deliveryService.ts"]:::del
    x3["catalogcheckout/business/<br/>checkoutService.ts"]:::cc
    x4["manageinventory/persistence/<br/>stockRepository.ts"]:::inv
  end
  x1 -.-x|"check-deployments · importar código do outro pacote"| x2
  x3 -.-x|"check-modules · regra 1 · import interno"| x4

  P2 ~~~ X

  linkStyle 0,1,2,3,4,5,7 stroke:#15803D,stroke-width:2px
  linkStyle 6 stroke:#1D4ED8,stroke-width:2px
  linkStyle 8,9 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef delc fill:#FFFFFF,stroke:#6D28D9,stroke-dasharray:5 4,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

`npm run check:arch`, na raiz:

1. Cada pacote tem o seu `package.json` (é implantável sozinho).
2. Nenhum pacote importa código de outro pacote: só falam por HTTP.
3. Dentro do sandwiches, as regras do `modular/`: um módulo só usa outro pelo `index.ts`, `shared/` não depende de módulos e cada módulo só usa as suas tabelas.

Pela rede só passam ids e valores simples: a encomenda vai como `{ id, storeId }`, não como o objeto completo.

> **Perguntar:** "Porque é que o `shared/` está copiado, e não partilhado?" → Se os dois pacotes importassem a mesma pasta, já não se podiam implantar à parte: a regra 2 falhava. Com dois pacotes de deployment, o código comum ou se copia ou se publica como biblioteca com versão.

---

## 3 · Sequência do checkout

A mesma sequência do `modular/`. A diferença está nas duas chamadas ao Delivery (passos 4 e 8), que agora atravessam a rede. A taxa de entrega é pedida **antes** de reservar o stock e de cobrar; por isso, com o Delivery em baixo, o checkout falha com 503 sem deixar nada a meio.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  box rgba(128,128,128,0.12) pacote sandwiches · :3003
    participant CC as checkoutController
    participant CS as checkoutService
    participant LOC as location.api
    participant PRO as promotion.api
    participant INV as inventory.api → recipes.api
    participant MO as makeOrder.api
    participant DC as delivery/index.ts (cliente HTTP)
    participant DB1 as silicon-sandwiches.db
  end
  box rgba(221,214,254,0.45) pacote delivery · :3004
    participant PUB as publicApi.ts
    participant DS as deliveryService
    participant DB2 as delivery.db
  end

  C->>CC: POST /checkout
  CC->>CS: checkout(body)
  CS->>LOC: getStore(storeId)
  LOC->>DB1: location_store
  CS->>DB1: menuFor (catalogRepository)
  opt há código promocional
    CS->>PRO: discountFor(…)
    PRO->>DB1: promotion_code
  end
  opt entrega ao domicílio
    CS->>DC: quote(store, address)
    alt o Delivery responde
      DC->>PUB: POST /api/quotes { store: { id, name }, address }
      PUB->>DS: quote(…)
      DS->>DB2: delivery_zone
      PUB-->>DC: 200 { available, feeCents, etaMinutes }
      DC-->>CS: quote
    else não responde em 2 s
      DC-->>CS: ServiceUnavailableError
      CS-->>CC: 503 (nada reservado, nada cobrado)
    end
  end
  CS->>INV: reserve(storeId, lines)
  INV->>DB1: recipe_ingredient · inventory_stock_*
  CS->>CS: payment.charge (gateway simulado)
  alt pagamento recusado
    CS->>INV: release(reservationId)
    CS-->>CC: PaymentDeclinedError (402)
  else pagamento aprovado
    CS->>DB1: INSERT checkout_* (uma transação)
    CS->>PRO: redeem(…) se houver código
    CS->>MO: enqueue(order)
    MO->>DB1: kitchen_ticket
    opt entrega ao domicílio
      CS->>DC: schedule({ order, address })
      DC->>PUB: POST /api/deliveries { order: { id, storeId }, address }
      PUB->>DS: schedule(…)
      DS->>DB2: INSERT delivery_job
      PUB-->>DC: 201
    end
    CS-->>CC: order
    CC-->>C: 201 Created
  end
  Note over CS,DB2: se o Delivery cair entre gravar a encomenda e agendar a entrega, a encomenda fica paga e sem entrega
```

> **Perguntar:** "Quantos pedidos HTTP faz agora um checkout com entrega? E com levantamento na loja?" → Com entrega, dois entre os pacotes (`/api/quotes` e `/api/deliveries`); com levantamento, nenhum. Por isso, com o Delivery desligado, o levantamento continua a funcionar e só a entrega ao domicílio responde 503.

---

## 4 · Dados

As mesmas 15 tabelas e as mesmas 6 chaves estrangeiras do `modular/`, mas em **duas bases de dados**: 13 tabelas no pacote sandwiches e 2 no pacote delivery. Mudar as tabelas `delivery_*` de base de dados não partiu nenhuma FK, porque no `modular/` já não as tinham. Das 12 referências sem FK, 3 passam a atravessar bases de dados (a vermelho). As contagens são minhas, feitas a partir dos `schema.sql`.

```mermaid
flowchart LR
  subgraph DB1["packages/sandwiches · data/silicon-sandwiches.db"]
    subgraph CCm["catalogcheckout"]
      checkout_sandwich:::cc
      checkout_store_menu:::cc
      checkout_customer_order:::cc
      checkout_order_line:::cc
    end
    subgraph LOCm["location"]
      location_store:::loc
    end
    subgraph RECm["recipes"]
      recipe_ingredient:::rec
    end
    subgraph INVm["manageinventory"]
      inventory_stock_level:::inv
      inventory_stock_reservation:::inv
      inventory_stock_reservation_line:::inv
    end
    subgraph PROm["promotion"]
      promotion_code:::promo
      promotion_redemption:::promo
    end
    subgraph MOm["makeorder"]
      kitchen_ticket:::mo
      kitchen_ticket_item:::mo
    end
  end
  subgraph DB2["packages/delivery · data/delivery.db"]
    delivery_zone:::del
    delivery_job:::del
  end

  %% FK dentro do módulo (0–5)
  checkout_store_menu --> checkout_sandwich
  checkout_order_line --> checkout_customer_order
  checkout_order_line --> checkout_sandwich
  inventory_stock_reservation_line --> inventory_stock_reservation
  promotion_redemption --> promotion_code
  kitchen_ticket_item --> kitchen_ticket

  %% id de outro módulo, sem FK, na mesma base de dados (6–14)
  checkout_store_menu -.-> location_store
  checkout_customer_order -.-> location_store
  recipe_ingredient -.-> checkout_sandwich
  inventory_stock_level -.-> location_store
  inventory_stock_reservation -.-> location_store
  promotion_code -.-> location_store
  promotion_redemption -.-> checkout_customer_order
  kitchen_ticket -.-> checkout_customer_order
  kitchen_ticket -.-> location_store

  %% id noutra base de dados (15–17)
  delivery_zone -.-> location_store
  delivery_job -.-> checkout_customer_order
  delivery_job -.-> location_store

  linkStyle 15,16,17 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
```

> **Perguntar:** "O `store_id` das zonas de entrega está noutra base de dados. Quem garante que a loja existe?" → Ninguém, automaticamente. No `modular/` já era o código a garantir; agora nem sequer uma consulta o pode verificar, porque as tabelas estão em processos diferentes. O Delivery só sabe da loja o que o checkout lhe manda no pedido (`{ id, name }`).
