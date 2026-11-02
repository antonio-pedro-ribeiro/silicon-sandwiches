# Silicon Sandwiches · Microservices

O mesmo sistema, com **um microsserviço por componente do kata**. Cada serviço corre no seu processo e é dono da sua **base de dados** (*database-per-service*). Os clientes só entram pelo **API gateway**, que também serve a interface web.

| Serviço | Pasta | Base de dados | Porta | Chama | Recebe `OrderPlaced` |
|---|---|---|---|---|---|
| Checkout | `services/checkout/` | `data/checkout.db` | 3201 | Location, Promotion, Delivery, Inventory | — (publica) |
| Location | `services/location/` | `data/location.db` | 3202 | — | — |
| Promotion | `services/promotion/` | `data/promotion.db` | 3203 | — | regista o código usado |
| Inventory | `services/inventory/` | `data/inventory.db` | 3204 | Recipes | — |
| Recipes | `services/recipes/` | `data/recipes.db` | 3205 | — | — |
| Kitchen | `services/kitchen/` | `data/kitchen.db` | 3206 | — | cria o bilhete |
| Delivery | `services/delivery/` | `data/delivery.db` | 3207 | — | agenda a entrega |
| API gateway + interface | `gateway/` | — | 3200 | todos (só encaminha) | — |

O código de cada serviço vem do módulo correspondente do [`modular/`](../modular/): os mesmos `business/` e `persistence/`, agora com uma `api/` HTTP e uma base de dados só sua.

## Como executar

Node **22.13 ou superior**, sem dependências: não é preciso `npm install`.

```powershell
cd microservices
npm start           # arranca os 8 processos; abrir http://localhost:3200
npm run demo        # 9 checkouts na consola, com todos os pedidos HTTP entre serviços
npm test            # os 9 testes de sempre + 4 testes dos microsserviços
npm run check:arch  # regras dos microsserviços e mapa do acoplamento dinâmico (ver abaixo)
npm run reset:db    # com os serviços parados: limpa as 7 bases de dados; mantém o catálogo
```

Cada serviço também arranca sozinho (`npm start` na sua pasta) e lê `PORT`, `DB_PATH` e os URLs dos serviços de que depende (`LOCATION_URL`, `RECIPES_URL`, …). As portas de todos estão em `scripts/topology.json`.

## O checkout: saga orquestrada + evento coreografado

`services/checkout/src/business/checkoutService.js` tem os mesmos passos de sempre, mas cada um é agora um pedido HTTP a outro serviço:

| Passo | Como | Se falhar |
|---|---|---|
| 1. Loja aberta? | `GET location /api/stores/:id` | 404/422, ou 503 se o Location não responder |
| 2. Menu e preços | base de dados do Checkout | — |
| 3. Desconto | `POST promotion /api/discounts` | 422, ou 503 |
| 4. Taxa de entrega | `POST delivery /api/quotes` | 422, ou 503 |
| 5. Reservar ingredientes | `POST inventory /api/reservations` (que faz `GET recipes /recipes/:id` por sandes) | 422, ou 503 |
| 6. Pagamento | gateway externo (simulado) | **compensação**: `POST inventory /api/reservations/:id/release` |
| 7. Gravar a encomenda | base de dados do Checkout, com o evento no *outbox*, na mesma transação local | — |
| 8. Avisar os outros | publicar `OrderPlaced` para Promotion, Kitchen e Delivery | o evento fica no *outbox* e volta a ser enviado de 2 em 2 s |

- **Passos 1 a 6: orquestração.** O Checkout é um mediador *local* (do seu próprio fluxo), não um orquestrador central. Como não há uma transação que abranja os serviços, um pagamento recusado obriga a uma **transação de compensação** no Inventory. É o padrão *Saga*.
- **Passo 8: coreografia.** O Checkout não chama a cozinha nem as entregas: publica um evento e cada serviço reage por si. Não sabe quem são os subscritores (chegam por configuração; em produção, seria um *broker* como Kafka ou RabbitMQ).
- ***Outbox*:** a encomenda e o evento são gravados na mesma transação local (`checkout_outbox`). Um evento só sai do *outbox* quando todos os subscritores o receberam.
- **Consumidores idempotentes:** como um evento pode ser entregue mais de uma vez, a Kitchen e o Delivery criam no máximo um bilhete/entrega por encomenda e o Promotion uma utilização por encomenda (`order_id UNIQUE`).

Compare com o [`service-based/`](../service-based/), onde os passos 5 a 8 são uma só transação ACID e um `ROLLBACK` substitui a compensação.

## Gateway e plataforma

- **O gateway só encaminha** (`gateway/src/gateway.js`): uma tabela de rotas públicas → serviço, mais preocupações transversais (escolha de instância e `/health` agregado). Não orquestra nem tem regras de negócio. As rotas internas (`/api/…` e `/events/…`) não são expostas: só os serviços as usam.
- **`platform/`** faz o papel do *sidecar* do livro: o que é operacional e beneficia de ser igual em todos os serviços (router HTTP, cliente HTTP com tempo limite e registo das chamadas, abertura da base de dados, erros → códigos HTTP). Não tem código de domínio. Em produção seria um processo ao lado de cada serviço (por exemplo, numa *service mesh* como o Istio); aqui é uma biblioteca, por simplicidade.
- **Duplicar em vez de partilhar:** nenhum serviço importa código de outro. O que cada um precisa de saber dos outros vem pela rede, só com os campos necessários (por exemplo, o evento leva os nomes das sandes, para a cozinha não ter de perguntar ao Checkout).

## Experiências

1. **Contar pedidos.** `npm run demo` e contar as linhas `[http]` de um checkout com entrega e promoção. Quantos pedidos de rede para uma encomenda? Compare com o `service-based/` (zero entre serviços).
2. **Desligar a cozinha.** Com `npm start`, parar o processo da porta 3206 e encomendar: a encomenda é aceite (201) e a cozinha aparece como indisponível. Voltar a ligar o Kitchen (`npm start` em `services/kitchen/`): em 2 s, o *outbox* entrega o evento e o bilhete aparece.
3. **Desligar o Location** (porta 3202). O menu continua a responder (`GET /stores/porto-aliados/menu`), mas a interface deixa de mostrar as lojas e nenhum checkout funciona (503). Que serviços são críticos para vender?

## Verificação das regras: `npm run check:arch`

1. Um serviço não importa código de outro serviço: só o seu e o de `platform/`.
2. A plataforma e o gateway não importam código de nenhum serviço.
3. Cada serviço só usa as tabelas do seu `schema.sql`.
4. O gateway não tem SQL.

No fim, mostra o **mapa do acoplamento dinâmico**, lido dos clientes HTTP de cada serviço:

```text
  checkout   → location, promotion, delivery, inventory
  inventory  → recipes
  evento OrderPlaced (checkout) → delivery, kitchen, promotion
```

## Testes

- `test/system.test.js`: os 9 testes de sempre, com os sete serviços a sério (BD em memória) atrás do gateway.
- `test/microservices.test.js`:
  - com a Kitchen desligada, a encomenda é aceite e o bilhete aparece quando a Kitchen volta;
  - o mesmo `OrderPlaced` entregue duas vezes cria um só bilhete;
  - com o Location desligado não há checkouts, mas o menu continua;
  - o gateway não expõe as rotas internas.

## Perguntas para a aula

1. ***Grains of sand*:** o Inventory pede ao Recipes uma receita por sandes, em cada checkout. Recipes devia ser um serviço? Que alternativas há (juntar ao Inventory, uma cópia local das receitas, *cache*)?
2. **Consistência eventual:** o `BEMVINDO` só pode ser usado uma vez por cliente, mas a utilização só é registada quando o evento chega ao Promotion. Se o Promotion estiver lento, o mesmo cliente consegue usar o código duas vezes?
3. **Compensação que falha:** o que acontece se o Inventory cair entre a reserva (passo 5) e a compensação (passo 6)? E se o pagamento for aceite e a gravação da encomenda (passo 7) falhar?
4. **Transações:** o livro diz "se precisa de transações entre serviços, corrija a granularidade". Que serviços juntaria para não precisar de compensações?
5. **Custo:** 8 processos, 7 bases de dados, um *outbox*, consumidores idempotentes, tempos limite. O que se ganhou em relação ao `service-based/` (escalar, falhar e implantar cada parte à parte)? Para a Silicon Sandwiches, vale a pena?
