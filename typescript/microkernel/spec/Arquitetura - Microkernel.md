#fcul

# Silicon Sandwiches · Microkernel · diagramas de arquitetura

Quatro vistas do código em `microkernel/`, na mesma ordem e com as mesmas cores de [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md), para as comparar lado a lado. O núcleo é o `modular/`; o que varia por loja e por código promocional saiu para plug-ins.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Microkernel.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual em todas as versões:

| Cor | Componente / módulo |
|---|---|
| 🟨 amarelo | CatalogCheckout · `catalogcheckout/` |
| 🟦 azul | Location · `location/`, e os plug-ins de loja (`store/…`, a tracejado) |
| 🩷 rosa | Promotion · `promotion/`, e os plug-ins de promoção (`promotion/…`, a tracejado) |
| 🟩 verde | ManageInventory · `manageinventory/` |
| 🟧 laranja | MakeOrder · `makeorder/` |
| 🟪 roxo | Delivery · `delivery/` |
| 🩵 ciano | Recipes · `recipes/` |
| ⬜ cinzento | técnico / partilhado |

Um plug-in de loja personaliza uma loja: o menu (que o CatalogCheckout usa) e as entregas (que o Delivery usa). Fica a azul porque é "da loja", não de um destes dois componentes.

---

## 1 · Particionamento de topo

O primeiro corte é entre **núcleo** e **plug-ins**. O núcleo (`src/core/`) faz o caminho feliz e é, por dentro, um monólito modular com os sete módulos do `modular/`. Os plug-ins (`src/plugins/`) isolam o que muda muito: o menu e as entregas de cada loja, e a regra de cada código promocional. Só `app.ts` conhece os dois lados.

```mermaid
flowchart TB
  app["app.ts · raiz de composição: o único ficheiro que conhece o núcleo e os plug-ins · server.ts"]:::tech

  subgraph CORE["src/core/ · o núcleo (o caminho feliz)"]
    direction TB
    subgraph MOD["modules/ · os sete módulos do modular/"]
      direction LR
      cc["catalogcheckout/<br/>catálogo comum + plug-in da loja<br/>(sem checkout_store_menu)"]:::cc
      loc["location/"]:::loc
      promo["promotion/<br/>pede a regra ao plug-in do código<br/>(só guarda as utilizações)"]:::promo
      inv["manageinventory/"]:::inv
      mo["makeorder/"]:::mo
      del["delivery/<br/>taxa e tempo vêm do plug-in da loja<br/>(sem delivery_zone)"]:::del
      rec["recipes/"]:::rec
    end
    host["plugins/ · contracts.ts · pluginHost.ts<br/>valida e indexa os plug-ins"]:::tech
    shared["shared/ · db.ts · http.ts · errors.ts · mockLog.ts · web/"]:::tech
    db[("SQLite · 1 base de dados · 12 tabelas")]:::tech
  end

  subgraph PLUG["src/plugins/ · os plug-ins"]
    direction TB
    subgraph ST["store/ · contrato store"]
      direction LR
      pa["porto-aliados<br/>francesinha a 6,50 €<br/>entregas 2,50 € (30 min)"]:::plugloc
      lcg["lisboa-campo-grande<br/>bifana a 4,80 € · sem prego<br/>entregas 3,00 € (35 min)"]:::plugloc
    end
    subgraph PR["promotion/ · contrato promotion"]
      direction LR
      f["fcul10<br/>10% FCUL"]:::plugpromo
      m["menos1<br/>1 € acima de 10 €"]:::plugpromo
      p["porto15<br/>15% só nos Aliados"]:::plugpromo
      b["bemvindo<br/>2 € na 1.ª encomenda"]:::plugpromo
    end
    reg["registry.ts · importa e lista os plug-ins ativos"]:::tech
  end

  app --> CORE
  app --> PLUG

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
  classDef plugloc fill:#BFDBFE,stroke:#1D4ED8,stroke-dasharray:5 4,color:#111
  classDef plugpromo fill:#FBCFE8,stroke:#BE185D,stroke-dasharray:5 4,color:#111
```

Coimbra não tem plug-in: vende o menu comum e não faz entregas. É o caminho feliz. Continua a ser um só processo com uma só base de dados: um único *quantum*, como no `modular/`.

> **Perguntar:** "A Silicon Sandwiches abre uma loja em Braga com um prato próprio. Onde se mexe?" → Cria-se `src/plugins/store/braga/index.ts` e junta-se uma linha a `registry.ts`. O núcleo não muda. Se a loja não tiver nada de especial, nem isso: sem plug-in, vende o menu comum.

---

## 2 · Regras de dependência

O núcleo **não importa** plug-ins, e os plug-ins **não importam** nada fora da sua pasta: nem o núcleo, nem outros plug-ins. Quem os junta é `app.ts`, que entrega o registo ao `pluginHost`. A partir daí, os módulos do núcleo procuram o plug-in pela loja ou pelo código e chamam-no pelo contrato, sem nenhum `if (loja === 'porto')`.

```mermaid
flowchart TB
  app["app.ts"]:::tech
  reg["plugins/registry.ts"]:::tech
  host["core/plugins/pluginHost.ts<br/>contracts.ts"]:::tech
  cc["catalogcheckout<br/>index.ts"]:::cc
  promo["promotion<br/>index.ts"]:::promo
  del["delivery<br/>index.ts"]:::del
  loc["location<br/>index.ts"]:::loc
  inv["manageinventory<br/>index.ts"]:::inv
  mo["makeorder<br/>index.ts"]:::mo
  rec["recipes<br/>index.ts"]:::rec
  ps["plug-ins store/…<br/>storeId · menu(common) · delivery"]:::plugloc
  pp["plug-ins promotion/…<br/>code · evaluate(ctx)"]:::plugpromo

  app -->|importa| reg
  app -->|"createPluginHost(plugins)"| host
  reg -->|importa| ps
  reg -->|importa| pp
  cc -->|"plugins.store(id).menu(common)"| host
  del -->|"plugins.store(id).delivery"| host
  promo -->|"plugins.promotion(code).evaluate(ctx)"| host
  host -.->|"chama pelo contrato (sem import)"| ps
  host -.->|"chama pelo contrato (sem import)"| pp
  cc -->|getStore| loc
  cc -->|"discountFor · redeem"| promo
  cc -->|"reserve · release"| inv
  cc -->|enqueue| mo
  cc -->|"quote · schedule"| del
  inv -->|get| rec

  subgraph X["✘ o que o check:arch rejeita"]
    direction LR
    x1["core/…"]:::tech
    x2["plugins/store/porto-aliados/index.ts"]:::plugloc
    x3["plugins/promotion/porto15/index.ts"]:::plugpromo
    x4["plugins/store/porto-aliados/index.ts"]:::plugloc
    x5["plugins/promotion/natal<br/>(sem evaluate)"]:::plugpromo
    x6["contrato promotion"]:::tech
  end
  x1 -.-x|"regra 1 · o núcleo importa um plug-in"| x2
  x3 -.-x|"regra 2 · um plug-in importa outro"| x4
  x5 -.-x|"regra 3 · recusado no arranque"| x6

  rec ~~~ X

  linkStyle 0,1,2,3,4,5,6,9,10,11,12,13,14 stroke:#15803D,stroke-width:2px
  linkStyle 15,16,17 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
  classDef plugloc fill:#BFDBFE,stroke:#1D4ED8,stroke-dasharray:5 4,color:#111
  classDef plugpromo fill:#FBCFE8,stroke:#BE185D,stroke-dasharray:5 4,color:#111
```

As quatro regras de `scripts/check-microkernel.ts` (`npm run check:arch`):

1. O núcleo (`src/core/`) não importa nada de `src/plugins/`.
2. Um plug-in só importa ficheiros da sua pasta: não depende do núcleo nem de outros plug-ins.
3. Todos os plug-ins estão no registo e cumprem o contrato (`contracts.ts`).
4. Dentro do núcleo, as regras do `modular/`: um módulo só usa outro pelo `index.ts` e só usa as suas tabelas.

> **Perguntar:** "O `BEMVINDO` só vale na primeira encomenda. Como sabe quantas vezes o cliente já o usou, se os plug-ins não acedem à base de dados?" → O núcleo conta as utilizações na tabela `promotion_redemption` e passa o número ao plug-in (`timesUsed`). O plug-in decide só com o que recebe, e por isso testa-se sozinho, sem núcleo nem base de dados.

---

## 3 · Sequência do checkout

O `checkoutService.ts` é igual ao do `modular/`: os passos são os mesmos. A diferença está **dentro** de três módulos do núcleo, que perguntam aos plug-ins o que antes liam de tabelas: o menu da loja, a regra do código e a taxa de entrega.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  box rgba(253,230,138,0.35) catalogcheckout
    participant CC as checkoutController
    participant CS as checkoutService
    participant CAT as catalogService
  end
  box rgba(191,219,254,0.35) location
    participant LOC as location.api
  end
  box rgba(251,207,232,0.35) promotion
    participant PRO as promotion.api
  end
  box rgba(221,214,254,0.35) delivery
    participant DEL as delivery.api
  end
  box rgba(128,128,128,0.12) plug-ins · pelo pluginHost
    participant PS as plug-in da loja
    participant PP as plug-in do código
  end
  box rgba(187,247,208,0.35) manageinventory + recipes
    participant INV as inventory.api → recipes.api
  end
  box rgba(254,215,170,0.35) makeorder
    participant MO as makeOrder.api
  end
  box rgba(128,128,128,0.12) database
    participant DB as SQLite · tabelas por módulo
  end

  C->>CC: POST /checkout
  CC->>CS: checkout(body)
  CS->>LOC: getStore(storeId)
  LOC->>DB: location_store
  CS->>CAT: menuFor(storeId)
  CAT->>DB: checkout_sandwich (o catálogo comum)
  CAT->>PS: plugins.store(storeId)?.menu(common)
  Note over CAT,PS: sem plug-in (Coimbra): fica o menu comum
  opt há código promocional
    CS->>PRO: discountFor(…)
    PRO->>DB: COUNT promotion_redemption (timesUsed)
    PRO->>PP: evaluate({ storeId, customerId, subtotalCents, timesUsed })
    PP-->>PRO: { valid, discountCents } ou { valid: false, reason }
  end
  opt entrega ao domicílio
    CS->>DEL: quote(store, address)
    DEL->>PS: plugins.store(storeId)?.delivery
    DEL-->>CS: { available, feeCents, etaMinutes }
  end
  CS->>INV: reserve(storeId, lines)
  INV->>DB: recipe_ingredient · inventory_stock_*
  CS->>CS: payment.charge (gateway simulado)
  alt pagamento recusado
    CS->>INV: release(reservationId)
    CS-->>CC: PaymentDeclinedError (402)
  else pagamento aprovado
    CS->>DB: INSERT checkout_* (uma transação)
    CS->>PRO: redeem(…) se houver código
    PRO->>DB: promotion_redemption
    CS->>MO: enqueue(order)
    MO->>DB: kitchen_ticket
    opt entrega ao domicílio
      CS->>DEL: schedule(…)
      DEL->>PS: delivery.etaMinutes
      DEL->>DB: delivery_job
    end
    CS-->>CC: order
    CC-->>C: 201 Created
  end
```

> **Perguntar:** "O núcleo sabe que existe uma loja no Porto?" → Não. Sabe que existe um plug-in com `storeId: 'porto-aliados'`, porque o `pluginHost` o indexou. O nome do Porto, a francesinha e a taxa de 2,50 € estão só no plug-in.

---

## 4 · Dados

**12 tabelas e 3 chaves estrangeiras**, todas dentro de um módulo. Saíram três tabelas do `modular/`, porque a personalização deixou de ser dados e passou a ser código: `checkout_store_menu` e `delivery_zone` foram para os plug-ins de loja, `promotion_code` para os plug-ins de promoção. A francesinha saiu do catálogo comum para o plug-in do Porto, por isso `checkout_order_line.sandwich_id` perdeu a FK para `checkout_sandwich`. As contagens são minhas, feitas a partir dos `schema.sql`.

```mermaid
flowchart LR
  subgraph CCm["catalogcheckout/persistence/schema.sql"]
    checkout_sandwich:::cc
    checkout_customer_order:::cc
    checkout_order_line:::cc
  end
  subgraph LOCm["location/…/schema.sql"]
    location_store:::loc
  end
  subgraph RECm["recipes/…/schema.sql"]
    recipe_ingredient:::rec
  end
  subgraph INVm["manageinventory/…/schema.sql"]
    inventory_stock_level:::inv
    inventory_stock_reservation:::inv
    inventory_stock_reservation_line:::inv
  end
  subgraph PROm["promotion/…/schema.sql"]
    promotion_redemption:::promo
  end
  subgraph MOm["makeorder/…/schema.sql"]
    kitchen_ticket:::mo
    kitchen_ticket_item:::mo
  end
  subgraph DELm["delivery/…/schema.sql"]
    delivery_job:::del
  end
  subgraph PLG["plug-ins · código, não tabelas"]
    ps["store/… · menu · delivery<br/>(era checkout_store_menu e delivery_zone)"]:::plugloc
    pp["promotion/… · evaluate<br/>(era promotion_code)"]:::plugpromo
  end

  %% FK dentro do módulo (0–2)
  checkout_order_line --> checkout_customer_order
  inventory_stock_reservation_line --> inventory_stock_reservation
  kitchen_ticket_item --> kitchen_ticket

  %% id guardado, sem FK (3–12)
  checkout_order_line -.-> checkout_sandwich
  checkout_customer_order -.-> location_store
  recipe_ingredient -.-> checkout_sandwich
  inventory_stock_level -.-> location_store
  inventory_stock_reservation -.-> location_store
  promotion_redemption -.-> checkout_customer_order
  kitchen_ticket -.-> checkout_customer_order
  kitchen_ticket -.-> location_store
  delivery_job -.-> checkout_customer_order
  delivery_job -.-> location_store

  %% id de um plug-in (13–14)
  promotion_redemption -.->|code| pp
  ps -.->|storeId| location_store

  linkStyle 13,14 stroke:#BE185D,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef plugloc fill:#BFDBFE,stroke:#1D4ED8,stroke-dasharray:5 4,color:#111
  classDef plugpromo fill:#FBCFE8,stroke:#BE185D,stroke-dasharray:5 4,color:#111
```

| | Modular | Microkernel |
|---|---|---|
| Tabelas | 15 | 12 |
| Chaves estrangeiras | 6 | 3 |
| Menu local, zonas de entrega, códigos promocionais | linhas em tabelas | código, nos plug-ins |
| Criar um código promocional novo | um `INSERT` | um plug-in, um *deploy* |

> **Perguntar:** "Dados ou código: o que se ganhou e o que se perdeu?" → Ganhou-se poder escrever regras arbitrárias, que já não têm de caber nas colunas de `promotion_code` (percentagem, valor, mínimo, loja, limite por cliente), e testá-las uma a uma. Perdeu-se a possibilidade de o marketing criar um código sem um *deploy*, e a base de dados deixou de saber que códigos e que lojas com entrega existem.
