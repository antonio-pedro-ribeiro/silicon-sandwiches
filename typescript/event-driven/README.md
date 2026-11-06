# Silicon Sandwiches · Event-Driven Architecture (RabbitMQ)

O mesmo sistema, com **sete microsserviços desacoplados através de Event-Driven Architecture (EDA)** utilizando um message broker **RabbitMQ** (com fallback automático in-memory para desenvolvimento ágil e testes unitários).

| Serviço | Pasta | Base de dados | Porta | Chamadas síncronas (HTTP) | Eventos Consumidos (RabbitMQ AMQP) |
|---|---|---|---|---|---|
| Checkout | `services/checkout/` | `data/checkout.db` | 3301 | Location, Promotion, Delivery, Inventory | *(Publica `OrderPlaced` via Outbox)* |
| Location | `services/location/` | `data/location.db` | 3302 | — | — |
| Promotion | `services/promotion/` | `data/promotion.db` | 3303 | — | Fila `promotion.orders.placed` (`orders.placed`) |
| Inventory | `services/inventory/` | `data/inventory.db` | 3304 | Recipes | — |
| Recipes | `services/recipes/` | `data/recipes.db` | 3305 | — | — |
| Kitchen | `services/kitchen/` | `data/kitchen.db` | 3306 | — | Fila `kitchen.orders.placed` (`orders.placed`) |
| Delivery | `services/delivery/` | `data/delivery.db` | 3307 | — | Fila `delivery.orders.placed` (`orders.placed`) |
| API Gateway | `gateway/` | — | 3300 | Todos (encaminhamento público) | — |

---

## 1. Como executar o RabbitMQ via Docker

Um ficheiro `docker-compose.yml` está incluído nesta pasta para iniciar o contentor RabbitMQ local com consola de gestão:

```powershell
docker compose up -d
# ou
npm run rabbit:up
```

- **AMQP Broker**: `amqp://localhost:5672`
- **Management UI**: `http://localhost:15672` (login: `guest` / password: `guest`)

Para parar o contentor:
```powershell
npm run rabbit:down
```

> **Zero setup / Modo sem contentor:** Caso o RabbitMQ não esteja a correr ou a biblioteca `amqplib` não esteja instalada, o sistema ativa automaticamente um **emulador AMQP completo in-memory** (`platform/rabbitmq.ts`), garantindo que `npm test`, `npm run demo` e `npm start` funcionam imediatamente.

---

## 2. Comandos de Arranque

Node **22.13 ou superior** (executa TypeScript nativamente sem compilação prévia via `--experimental-strip-types`):

```powershell
cd typescript/event-driven
npm start           # arranca os 8 processos; interface web em http://localhost:3300
npm run demo        # 9 checkouts na consola, mostrando chamadas HTTP e eventos AMQP
npm test            # 13 testes (9 de sistema + 4 de resiliência e concorrência AMQP)
npm run check:arch  # fitness functions de arquitetura (imports, banco e filas)
npm run typecheck   # verificação estrita de tipos com tsc
npm run reset:db    # limpa as 7 bases de dados SQLite mantendo o catálogo
```

---

## 3. Diagramas de Arquitetura

Diagramas completos também disponíveis em [`spec/Arquitetura - Event-Driven.md`](spec/Arquitetura%20-%20Event-Driven.md).

### 3.1. Topologia e Particionamento

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

### 3.2. Fluxo do Checkout (Saga Orquestrada + Outbox Pattern)

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

---

## 4. O Checkout: Saga Orquestrada + Publicação AMQP via Outbox

1. **Passos 1 a 6 (Saga Orquestrada via HTTP):**
   - Valida a loja (`location`), calcula preços locais (`catalog`), verifica desconto (`promotion`), quota de entrega (`delivery`), reserva ingredientes (`inventory` → `recipes`), e cobra pagamento simulado.
   - Se o pagamento falhar, o Checkout executa uma transação de compensação libertando os ingredientes reservados (`inventory release`).

2. **Passo 7 (Outbox Pattern Atómico):**
   - O Checkout grava a encomenda e o evento `OrderPlaced` na mesma transação local SQLite na tabela `checkout_outbox`.

3. **Passo 8 (Publicação e Roteamento AMQP):**
   - O `eventPublisher.ts` despacha os eventos pendentes para a Topic Exchange `silicon.events` com routing key `orders.placed`.
   - As mensagens só são removidas do outbox após confirmação do broker (*at-least-once delivery*).
   - O broker RabbitMQ encaminha cópias para as filas duráveis com bindings independentes:
     - `kitchen.orders.placed`
     - `delivery.orders.placed`
     - `promotion.orders.placed`

4. **Consumidores Desacoplados e Idempotentes:**
   - Se o serviço Kitchen ou Delivery estiver temporariamente em baixo, o checkout é concluído com sucesso (201). Quando o serviço regressa, consome a mensagem persistida na fila e atualiza o estado sem perda de dados.
   - Cada consumidor garante idempotência através de chave única de encomenda (`order_id UNIQUE`).

---

## 5. Verificação das Regras: `npm run check:arch`

1. **Isolamento de Código:** Nenhum serviço importa código de outro serviço (apenas código próprio e `platform/`).
2. **Sidecar/Plataforma Neutra:** `platform/` e `gateway/` não importam código de domínio.
3. **Database-per-Service:** Cada serviço só acede às tabelas do seu respetivo `schema.sql`.
4. **Sem SQL no Gateway:** O API gateway apenas encaminha rotas públicas.
5. **Mapeamento de Mensagens:** Valida produtores outbox e subscrições de filas no RabbitMQ.
