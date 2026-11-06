# Silicon Sandwiches em TypeScript

Os mesmos sete exemplos de [`../js/`](../js/), com a mesma funcionalidade, os mesmos estilos de arquitetura, as mesmas portas e os mesmos testes, escritos em TypeScript (modo `strict`).

| Pasta | Estilo | Porta |
|---|---|---|
| `layered/` | Layered | 3000 |
| `modular/` | Modular Monolith | 3001 |
| `big-ball-of-mud/` | Big Ball of Mud (anti-padrão) | 3002 |
| `modular-with-two-packages/` | Modular, 2 deployments | 3003 · 3004 |
| `microkernel/` | Microkernel | 3005 |
| `service-based/` | Service-Based | 3100 · 3101–3111 |
| `microservices/` | Microservices | 3200 · 3201–3207 |
| `event-driven/` | Event-Driven Architecture (RabbitMQ) | 3300 · 3301–3307 |

## Arranque

Node **22.13 ou superior**. Para correr não é preciso compilar nem instalar nada: o Node tira os tipos ao arrancar (`--experimental-strip-types`, já nos scripts do `package.json`).

```powershell
cd layered          # ou outro exemplo
npm run demo        # 9 checkouts na consola, com a BD em memória
npm test            # os mesmos testes da versão JavaScript
npm run check:arch  # verifica as regras de dependência
npm start           # servidor + interface web

npm install         # só para verificar os tipos (instala typescript e @types/node)
npm run typecheck   # tsc --noEmit, em modo strict
```

## O que muda em relação à versão JavaScript

**Só sintaxe que se apaga.** O Node não compila TypeScript: substitui as anotações por espaços. Por isso o `tsconfig.json` liga `erasableSyntaxOnly` (sem `enum`, `namespace` nem *parameter properties*) e os `import` usam a extensão `.ts`.

**O browser também é TypeScript.** A interface está em `web/…/app.ts`. O `webController.ts` serve-a em `/ui/app.js`, já sem tipos (`stripTypeScriptTypes` de `node:module`). No Big Ball of Mud, o código do browser continua dentro da classe e é enviado com `Function.prototype.toString()`, que já devolve o código sem tipos.

**O que chega da rede é `unknown`.** O corpo de um pedido HTTP, um plug-in e um evento só ganham um tipo depois de validados (`validate(body: unknown): CheckoutRequest`). As linhas que o `node:sqlite` devolve não têm tipo: cada repositório declara as colunas que espera (`rowsOf<OrderRow>(…)`).

**As dependências descrevem-se pelo que se usa delas.** O `checkoutService.ts` declara o que precisa de cada colaborador em `CheckoutDependencies`, com tipos estruturais, e não importa nada dos outros componentes. Por isso continua igual no `layered/`, no `modular/`, no `microkernel/` e no `modular-with-two-packages/`: um `diff` só mostra a linha do `import` dos erros.

### Os tipos em cada estilo

- **Layered:** as entidades (`Order`, `Store`, …) são declaradas na persistência; o negócio importa-as com `import type`, e a apresentação importa os tipos dos serviços. Os `import type` também contam para o `check:arch`, e respeitam as camadas.
- **Modular:** cada `index.ts` exporta a API pública do módulo e os seus tipos. O CatalogCheckout recebe os outros módulos pelos tipos de `CheckoutDependencies`.
- **Modular com dois pacotes:** o cliente HTTP do Delivery tem a mesma forma (tipo estrutural) que o módulo local, por isso o CatalogCheckout não muda. Os tipos do contrato HTTP são declarados de cada lado: nenhum pacote importa tipos do outro.
- **Microkernel:** o contrato dos plug-ins passa a ser um par de interfaces (`StorePlugin`, `PromotionPlugin`). Cada plug-in termina em `satisfies PromotionPlugin`, com um `import type` do contrato, a única exceção que o `check:arch` aceita. A validação no arranque continua: os tipos não existem em tempo de execução.
- **Service-Based:** cada biblioteca de entidades exporta os repositórios e os tipos da sua partição. O checkout continua a ser uma transação ACID (`transactionAsync<T>`).
- **Microservices:** não há tipos partilhados entre serviços. Quem chama diz o que espera receber (`client.post<DeliveryQuote>(…)`), e cada subscritor declara os campos do evento `OrderPlaced` que lê.
- **Big Ball of Mud:** `any` por todo o lado (`db: any`, `body: any`, …), assinalado com `LAMA:`. Compila em modo `strict`, mas o compilador não vê os nomes das colunas nem os campos do JSON.

### Pequenas diferenças

- Os testes dos plug-ins do microkernel passam um contexto completo a `evaluate` (`ctx({ storeId, subtotalCents })`), porque o tipo do contrato o exige.
- Onde o JavaScript assumia que um valor existia (a zona de entrega ao agendar uma entrega), o TypeScript obriga a tratar o caso em falta: lança `ValidationError` em vez de rebentar com `TypeError`.
