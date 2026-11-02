# Silicon Sandwiches · Service-Based

O mesmo sistema, distribuído por **quatro serviços de domínio** de grão grosso, cada um implantado à parte, mais uma **interface** que é também o API gateway. Todos usam **uma base de dados partilhada**, dividida em partições lógicas.

| Serviço | Pasta | Componentes do kata | Porta |
|---|---|---|---|
| Orders | `services/orders/` | CatalogCheckout, Promotion (+ gateway de pagamento simulado) | 3101 e 3111 (2 instâncias) |
| Stores | `services/stores/` | Location, ManageInventory, Recipes | 3102 |
| Kitchen | `services/kitchen/` | MakeOrder | 3103 |
| Delivery | `services/delivery/` | Delivery | 3104 |
| Interface + API gateway | `ui/` | — | 3100 |

Os serviços **não se chamam uns aos outros**. Integram-se pela base de dados partilhada: o checkout, no Orders, escreve diretamente o bilhete da cozinha e a entrega. Cada serviço é, por dentro, uma pequena arquitetura em camadas: `api/` (a fachada) → `business/` → bibliotecas de entidades.

## Como executar

Node **22.13 ou superior**, sem dependências: não é preciso `npm install`.

```powershell
cd service-based
npm start           # cria a BD partilhada (se não existir) e arranca os 6 processos; abrir http://localhost:3100
npm run demo        # 9 checkouts na consola; todos os serviços neste processo, com uma BD temporária
npm test            # os 9 testes de sempre + 3 testes do service-based
npm run check:arch  # regras do service-based e matriz de impacto (ver abaixo)
npm run reset:db    # com os serviços parados: apaga encomendas e afins; mantém o catálogo
```

`npm start` mostra a saída de cada processo prefixada (`[orders #1]`, `[stores   ]`, …). **Ctrl+C** para todos.

Para arrancar um serviço à parte (como em produção), primeiro `npm run setup:db` e depois `npm start` na pasta do serviço. Cada um lê `PORT` e `DB_PATH`; a interface lê `ORDERS_URLS` (lista separada por vírgulas), `STORES_URL`, `KITCHEN_URL` e `DELIVERY_URL`.

## A base de dados partilhada

```text
database/                    a base de dados, gerida à parte dos serviços (setup.js)
├─ common/     schema.sql · seed.sql    location_store
├─ orders/     …                         checkout_* · promotion_*
├─ inventory/  …                         inventory_* · recipe_ingredient
├─ kitchen/    …                         kitchen_*
└─ delivery/   …                         delivery_*
libs/                        bibliotecas partilhadas
├─ platform/            http.js · db.js · errors.js · mockLog.js
├─ common-entities/     storeRepository
├─ orders-entities/     catalogRepository · orderRepository · promotionRepository
├─ inventory-entities/  stockRepository · recipeRepository
├─ kitchen-entities/    kitchenRepository
└─ delivery-entities/   deliveryRepository
```

- Há **uma biblioteca de entidades por partição**, e não uma só biblioteca com todas as tabelas. Uma alteração numa tabela da partição *kitchen* só obriga a testar e reimplantar quem importa `kitchen-entities`.
- O SQL só existe nas bibliotecas de entidades. Os serviços usam os repositórios.
- As bibliotecas são importadas por caminho relativo (`../../../libs/…`). Em produção seriam pacotes publicados com versão (npm, JAR, DLL).

`npm run check:arch` termina com a **matriz de impacto**:

```text
Se mudar a biblioteca…            é preciso testar e reimplantar:
  common-entities                  services/orders, services/stores
  delivery-entities                services/delivery, services/orders
  inventory-entities               services/orders, services/stores
  kitchen-entities                 services/kitchen, services/orders
  orders-entities                  services/orders
  platform                         services/delivery, services/kitchen, services/orders, services/stores, ui
```

O Orders aparece em todas as linhas: o checkout mexe em todas as partições.

## O checkout numa só transação ACID

`services/orders/src/business/checkoutService.js` faz os passos 1 a 4 (loja, menu, desconto, taxa) e depois, **numa só transação**:

5. reserva os ingredientes (partição inventory);
6. cobra o pagamento;
7. grava a encomenda (partição orders);
8. regista o código usado, cria o bilhete da cozinha e a entrega (partições orders, kitchen e delivery).

Se o pagamento for recusado, ou faltar um ingrediente, faz-se `ROLLBACK` e não fica nada a meio. **Não há compensação**: no `modular/`, o checkout tem de chamar `inventory.release()` quando o pagamento falha; aqui basta o `ROLLBACK`. É o exemplo do livro do cartão expirado.

## Experiências

1. **Desligar a cozinha.** Com `npm start`, parar o processo da porta 3103. O checkout continua a funcionar, porque o Orders escreve o bilhete diretamente na base de dados. Os bastidores mostram "Serviço indisponível" na cozinha. Ao voltar a ligar o Kitchen (`npm start` em `services/kitchen/`, noutro terminal), os bilhetes estão lá.
2. **Desligar uma instância do Orders** (porta 3101 ou 3111). O gateway passa a usar só a outra; o ponto da instância fica vermelho nos bastidores.
3. **Mudar uma tabela.** Acrescentar uma coluna a `kitchen_ticket` (por exemplo, uma nota "sem cebola"). Que serviços é preciso alterar, testar e reimplantar? E se a coluna fosse em `location_store`?

## Verificação das regras: `npm run check:arch`

1. No máximo 12 serviços de domínio.
2. Um serviço (ou a interface) não importa código de outro serviço: só o seu e o de `libs/`.
3. Um serviço não faz pedidos HTTP a outro: a integração faz-se pela base de dados.
4. Só as bibliotecas de entidades têm SQL, e cada uma só usa as tabelas da sua partição.
5. Uma biblioteca só importa `libs/platform`.

## Testes

- `test/system.test.js`: os 9 testes de sempre, com todos os serviços a sério e a base de dados num ficheiro temporário.
- `test/service-based.test.js`:
  - pagamento recusado: depois do `ROLLBACK`, não há reservas nem encomendas na base de dados;
  - com o Kitchen desligado, o checkout continua e o bilhete aparece quando o Kitchen volta;
  - duas instâncias do Orders atrás do gateway veem as mesmas encomendas.

## Perguntas para a aula

1. **Transação longa:** a transação do checkout fica aberta enquanto se espera pelo banco. O que acontece aos outros checkouts se o banco demorar 5 segundos? Que alternativa há?
2. **Granularidade:** o Orders usa as cinco bibliotecas de entidades. É um serviço grande demais? Que parte tiraria primeiro, se fosse preciso?
3. ***Stepping stone*:** que serviços passaria a microsserviços, e porquê? Compare com [`microservices/`](../microservices/).
4. **Quanta:** quantos *quanta* tem este sistema? E se o Delivery passasse a ter a sua própria base de dados?
5. **Escalar:** porque é que só o Orders tem duas instâncias? O que limita escalar mais (pense no SQLite, nas ligações e nos *locks*)?
