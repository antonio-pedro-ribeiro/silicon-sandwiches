# Silicon Sandwiches · Modular · dois pacotes de deployment

Parte do mesmo código de [`modular/`](../modular/), que é um só pacote de deployment, e tira o módulo **Delivery** para um segundo pacote. Ficam dois processos, cada um com a sua base de dados, que falam por HTTP.

| Pacote | Pasta | Módulos | Base de dados | Porta |
|---|---|---|---|---|
| 1 · sandwiches | `packages/sandwiches/` | CatalogCheckout, Location, ManageInventory, Promotion, MakeOrder, Recipes + interface web | `packages/sandwiches/data/silicon-sandwiches.db` | 3003 |
| 2 · delivery | `packages/delivery/` | Delivery | `packages/delivery/data/delivery.db` | 3004 |

Cada pacote tem o seu `package.json`, o seu `server.js` e a sua cópia de `shared/`, e pode ser copiado, arrancado e implantado sem o outro. A pasta de topo (`modular-deployment/`) **não é implantada**: só junta os scripts de desenvolvimento (arrancar os dois, demo, testes de sistema).

## Como executar

Node **22.13 ou superior**, sem dependências: não é preciso `npm install`.

### Os dois pacotes de uma vez

```powershell
cd modular-deployment
npm start
```

Arranca os dois processos, com a saída de cada um prefixada (`[delivery  ]`, `[sandwiches]`). Abrir http://localhost:3003. **Ctrl+C** para os dois.

### Cada pacote no seu terminal (como em produção)

```powershell
# terminal 1
cd modular-deployment/packages/delivery
npm start                   # http://localhost:3004

# terminal 2
cd modular-deployment/packages/sandwiches
npm start                   # http://localhost:3003, fala com o Delivery em http://localhost:3004
```

A ordem não importa: o pacote sandwiches só chama o Delivery quando precisa dele.

Variáveis de ambiente (cada processo lê as suas):

| Variável | sandwiches | delivery |
|---|---|---|
| `PORT` | `3003` | `3004` |
| `DB_PATH` | `data/silicon-sandwiches.db` | `data/delivery.db` |
| `DELIVERY_URL` | `http://localhost:3004` | — |

Por exemplo, para o Delivery noutra porta:

```powershell
# terminal 1 (packages/delivery)
$env:PORT = 4000; npm start
# terminal 2 (packages/sandwiches)
$env:DELIVERY_URL = "http://localhost:4000"; npm start
```

### Outros comandos (na pasta `modular-deployment/`)

```powershell
npm run demo        # 9 checkouts na consola; os dois pacotes com a BD em memória, ligados por HTTP
npm test            # testes do delivery (3), do sandwiches (10) e de sistema (9, os mesmos das outras versões)
npm run check:arch  # nenhum pacote importa código do outro + regras de módulos do sandwiches
npm run reset:db    # limpa as duas bases de dados (com os servidores parados); mantém o catálogo e as zonas
```

Cada um destes comandos também existe dentro de cada pacote (`npm test`, `npm run reset:db`, e `npm run check:arch` no sandwiches). Para voltar aos dados de exemplo, apagar as pastas `packages/*/data/`.

## Experiência: desligar o Delivery

1. `npm start` e abrir http://localhost:3003.
2. Parar só o Delivery. Com dois terminais, Ctrl+C no do Delivery; com `npm start`, parar o processo que escuta na porta 3004.
3. Encomendar com **levantamento na loja**: funciona.
4. Encomendar com **entrega ao domicílio**: `503 O serviço Delivery não responde`. Não se gasta stock nem se cobra, porque a taxa de entrega é pedida (passo 4 do checkout) antes da reserva e do pagamento.
5. Nos bastidores, a cozinha continua a aparecer e as entregas mostram "Serviço Delivery indisponível".
6. Voltar a arrancar o Delivery: as entregas reaparecem, porque estão na base de dados dele.

No `modular/` isto não é possível: o Delivery está no mesmo processo e cai com os outros módulos.

## O que mudou em relação a `modular/`

```text
modular-deployment/
├─ packages/
│  ├─ sandwiches/                 pacote 1
│  │  ├─ src/
│  │  │  ├─ shared/               http.js (+503) · db.js · errors.js (+ServiceUnavailableError) · mockLog.js
│  │  │  ├─ modules/
│  │  │  │  ├─ catalogcheckout/ · location/ · promotion/ · manageinventory/ · makeorder/ · recipes/   (iguais)
│  │  │  │  └─ delivery/index.js  ← cliente HTTP com a mesma API pública
│  │  │  ├─ web/                  interface (selo e cor próprios; tolera o Delivery em baixo)
│  │  │  └─ app.js · server.js
│  │  ├─ scripts/  check-modules · reset-db
│  │  └─ test/     checkout.test.js · fakeDelivery.js (duplo do serviço Delivery)
│  └─ delivery/                   pacote 2
│     ├─ src/
│     │  ├─ shared/               cópia de http.js · db.js · errors.js
│     │  ├─ modules/delivery/     ← o módulo do modular/, sem alterações
│     │  ├─ publicApi.js          publica quote e schedule por HTTP
│     │  └─ app.js · server.js
│     ├─ scripts/  reset-db
│     └─ test/     delivery.test.js
├─ scripts/  start-all · demo · check-deployments
└─ test/     system.test.js       os dois pacotes a sério, ligados por HTTP
```

- **O módulo Delivery não mudou.** `packages/delivery/src/modules/delivery/` é igual a `modular/src/modules/delivery/`. Só ganhou `publicApi.js` à volta, que expõe a API do `index.js` por HTTP.
- **O CatalogCheckout também não mudou.** Continua a receber um `delivery` com `quote` e `schedule`. Quem chega agora é `packages/sandwiches/src/modules/delivery/index.js`, que traduz cada chamada num pedido HTTP e cada resposta 404/422 de volta num `NotFoundError`/`ValidationError`.
- **Só mudou a raiz de composição** (`app.js`), que passa a receber o `deliveryUrl`.
- **Uma base de dados por pacote.** No `modular/`, as tabelas `delivery_*` já não tinham chaves estrangeiras para os outros módulos, por isso foi possível mudá-las de base de dados sem partir nada.
- **`shared/` está copiado.** Com dois pacotes de deployment, o código comum ou se copia ou se publica como biblioteca com versão. Aqui copia-se, para os pacotes não dependerem um do outro.

## Contrato entre os pacotes

| Rota no Delivery (3004) | Quem chama | Corpo |
|---|---|---|
| `POST /api/quotes` | checkout, passo 4 | `{ store: { id, name }, address }` → `{ available, feeCents, etaMinutes }` ou `{ available: false, reason }` |
| `POST /api/deliveries` | checkout, passo 8 | `{ order: { id, storeId }, address }` → `201` com a entrega |
| `GET /deliveries` · `POST /deliveries/:id/advance` | interface web, reencaminhado pelo sandwiches | — |
| `GET /health` · `GET /routes` | — | — |

Pela rede só passam ids e valores simples: a encomenda vai como `{ id, storeId }`, não como o objeto completo. A interface continua a chamar `/deliveries` em http://localhost:3003, e o pacote sandwiches reencaminha esses pedidos para o 3004. Assim o browser só conhece uma origem.

Erros novos: **503** quando o Delivery não responde (2 s de timeout) ou devolve um erro inesperado.

## Testes

- `packages/delivery/test/`: o contrato HTTP do Delivery, sem o outro pacote.
- `packages/sandwiches/test/`: os 9 testes de sempre, contra um **duplo** do Delivery (`fakeDelivery.js`) que fala o mesmo contrato, mais um teste com o Delivery desligado. Não importa nada de `packages/delivery`.
- `test/system.test.js` (raiz): os mesmos 9 testes das outras versões, com os dois pacotes verdadeiros ligados por HTTP.

## Perguntas para a aula

1. **Compensação:** se o Delivery cair entre o passo 7 (gravar a encomenda) e o passo 8 (agendar a entrega), a encomenda fica gravada e paga, mas sem entrega. Num só processo, este problema já existia (exercício 4 do README principal). O que mudou na probabilidade de acontecer? Que soluções há (repetir o pedido, fila de mensagens, *outbox*)?
2. **Consistência:** o `store_id` das zonas de entrega está noutra base de dados. Quem garante que a loja existe?
3. **Latência:** quantos pedidos HTTP faz agora um checkout com entrega? E se o MakeOrder também saísse?
4. **Versões:** se o Delivery mudar o contrato (por exemplo, passar a exigir `address` na cotação), por que ordem se implantam os dois pacotes?
5. **Custo:** o que se ganhou (implantar e escalar o Delivery sozinho, isolar falhas) e o que se pagou (rede, timeouts, `shared/` copiado, testes de contrato)?
