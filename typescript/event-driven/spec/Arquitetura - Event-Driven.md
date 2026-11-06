# Silicon Sandwiches · Event-Driven Architecture · Diagramas de Arquitetura

Vistas de arquitetura do novo exemplo `event-driven/`, comparando o desacoplamento por eventos via **RabbitMQ** com as versões anteriores.

---

## 1 · Topologia e Particionamento

O sistema mantém **sete microsserviços independentes** com **database-per-service** e um **API Gateway** na porta `3300`. A comunicação assíncrona entre o Checkout e os serviços consumidores (Kitchen, Delivery, Promotion) é realizada através de um **Message Broker RabbitMQ** local (porta `5672`) utilizando o padrão **Transactional Outbox**.

```mermaid
flowchart LR
  gw["gateway/ · API Gateway + UI · :3300<br/>Encaminha pedidos públicos"]:::tech

  subgraph SV["services/ · 7 Microsserviços independentes (database-per-service)"]
    ck["checkout · :3301<br/>Saga local + Outbox Publisher"]:::cc
    lo["location · :3302"]:::loc
    pr["promotion · :3303<br/>Consumidor AMQP"]:::promo
    in["inventory · :3304"]:::inv
    re["recipes · :3305"]:::rec
    ki["kitchen · :3306<br/>Consumidor AMQP"]:::mo
    de["delivery · :3307<br/>Consumidor AMQP"]:::del

    ckdb[("checkout.db<br/>+ checkout_outbox")]:::cc
    lodb[("location.db")]:::loc
    prdb[("promotion.db")]:::promo
    indb[("inventory.db")]:::inv
    redb[("recipes.db")]:::rec
    kidb[("kitchen.db")]:::mo
    dedb[("delivery.db")]:::del
  end

  subgraph MB["RabbitMQ Message Broker · :5672 / :15672"]
    ex["Exchange: silicon.events<br/>(type: topic)"]:::broker
    q_ki["Queue: kitchen.orders.placed"]:::broker
    q_de["Queue: delivery.orders.placed"]:::broker
    q_pr["Queue: promotion.orders.placed"]:::broker
  end

  gw -->|HTTP| ck & lo & pr & in & re & ki & de
  ck --> ckdb
  lo --> lodb
  pr --> prdb
  in --> indb
  re --> redb
  ki --> kidb
  de --> dedb

  ck -->|AMQP Publish<br/>orders.placed| ex
  ex -->|Binding: orders.placed| q_ki & q_de & q_pr
  q_ki -->|AMQP Consume| ki
  q_de -->|AMQP Consume| de
  q_pr -->|AMQP Consume| pr

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
  classDef broker fill:#FFE8CC,stroke:#D9480F,color:#111
```

---

## 2 · Fluxo do Checkout (Saga Orquestrada + Outbox Pattern)

```mermaid
sequenceDiagram
  autonumber
  actor Cliente as Cliente / Gateway
  participant CK as Checkout (:3301)
  participant DB as Checkout DB
  participant LO as Location (:3302)
  participant PR as Promotion (:3303)
  participant DE as Delivery (:3307)
  participant IN as Inventory (:3304)
  participant RMQ as RabbitMQ (Exchange silicon.events)
  participant KI as Kitchen (:3306)

  Cliente->>CK: POST /checkout
  Note over CK,LO: Passo 1 · Loja aberta?
  CK->>LO: GET /api/stores/:id
  LO-->>CK: 200 OK
  Note over CK,PR: Passo 3 · Valida desconto
  CK->>PR: POST /api/discounts
  PR-->>CK: 200 OK
  Note over CK,DE: Passo 4 · Taxa de entrega
  CK->>DE: POST /api/quotes
  DE-->>CK: 200 OK
  Note over CK,IN: Passo 5 · Reserva stock
  CK->>IN: POST /api/reservations
  IN-->>CK: 201 Created (reservationId)
  Note over CK: Passo 6 · Pagamento (mock)
  Note over CK,DB: Passo 7 · ACID local: Encomenda + Outbox
  CK->>DB: BEGIN TRANSACTION<br/>INSERT INTO orders...<br/>INSERT INTO checkout_outbox (OrderPlaced)...<br/>COMMIT
  CK-->>Cliente: 201 Created (Order #ID)

  Note over CK,RMQ: Passo 8 · Dispatch assíncrono via RabbitMQ
  CK->>RMQ: Publish OrderPlaced (routingKey: orders.placed)
  RMQ-->>CK: Confirm / Ack
  CK->>DB: UPDATE checkout_outbox SET dispatched_at = now()

  par Entrega de Mensagens aos Consumidores
    RMQ->>KI: Push OrderPlaced (queue: kitchen.orders.placed)
    KI->>KI: Cria Kitchen Ticket (QUEUED)
  and
    RMQ->>DE: Push OrderPlaced (queue: delivery.orders.placed)
    DE->>DE: Agenda Entrega (SCHEDULED)
  and
    RMQ->>PR: Push OrderPlaced (queue: promotion.orders.placed)
    PR->>PR: Regista utilização do cupão
  end
```

