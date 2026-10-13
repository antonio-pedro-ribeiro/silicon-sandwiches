# Silicon Sandwiches · dois particionamentos de topo

Código de apoio à [[Aula 5 Script|Aula 5]] (slides 7, 8 e 10 de [[DS - Aula 5 - Estilos Arquiteturais (Cap. 9-11).pptx]]).

O mesmo sistema, a mesma funcionalidade e **os mesmos ficheiros**, organizados de duas formas:

| Pasta | Corte de topo | Estilo | Porta |
|---|---|---|---|
| `layered/` | Técnico: *presentation · business · persistence · database* | Layered | 3000 |
| `modular/` | Por domínio: um módulo por componente do kata | Modular Monolith | 3001 |
| `big-ball-of-mud/` | Nenhum: tudo numa só classe | Big Ball of Mud (anti-padrão) | 3002 |

Todos os componentes do kata estão implementados, com base de dados SQL: *CatalogCheckout*, *Location*, *Promotion*, *ManageInventory*, *MakeOrder*, *Delivery* e *Recipes*. Só o **gateway de pagamento** continua simulado, porque representa um sistema externo (um banco), não um componente nosso.

Os preços, as lojas, os stocks, as taxas de entrega e os códigos promocionais são inventados.

## Requisitos e arranque

Node **22.13 ou superior**. Não há dependências: o servidor usa `node:http` e a base de dados usa `node:sqlite` (SQLite embutido no Node, ainda marcado como experimental). Não é preciso `npm install`.

```powershell
cd layered        # ou: cd modular, ou: cd big-ball-of-mud
npm run demo        # 9 checkouts seguidos na consola (BD em memória, começa sempre do zero)
npm test            # 9 testes
npm run check:arch  # fitness functions das regras de dependência
npm run reset:db    # apaga encomendas, reservas, bilhetes…; mantém o catálogo
npm start           # servidor HTTP + interface web; a BD fica em data/silicon-sandwiches.db
```

Depois do `npm start`, abrir **http://localhost:3000** (Layered) **http://localhost:3001** (Modular) ou **http://localhost:3002** (Big Ball of Mud).

Para apagar as encomendas (e tudo o que os checkouts criaram) mantendo o catálogo, parar o servidor e correr `npm run reset:db`: o stock reservado volta às lojas e a numeração recomeça em 1. Para voltar aos dados de exemplo, apagar a pasta `data/`. Se o esquema mudar (constante `SCHEMA_VERSION` em `db.js`), uma base de dados antiga é recriada automaticamente.

## A mesma coisa, dois cortes

```text
layered/                                   modular/
├─ database/                               ├─ src/
│  ├─ schema.sql   ← todas as tabelas      │  ├─ shared/   http.js · db.js · errors.js · mockLog.js
│  └─ seed.sql                             │  ├─ modules/
├─ src/                                    │  │  ├─ catalogcheckout/   ← o checkout vive todo aqui
│  ├─ presentation/  7 controllers         │  │  │  ├─ index.js        (API pública)
│  │  ├─ http.js · webController.js        │  │  │  ├─ presentation/   checkoutController.js
│  │  ├─ checkoutController.js   ◄─┐       │  │  │  ├─ business/       checkout · catalog · payment
│  │  └─ web/  (interface)         │       │  │  │  └─ persistence/    repositórios · schema.sql · seed.sql
│  ├─ business/      9 serviços    │       │  │  ├─ location/         a mesma estrutura:
│  │  ├─ checkoutService.js      ◄─┤       │  │  ├─ promotion/          index.js
│  │  ├─ catalogService.js       ◄─┤       │  │  ├─ manageinventory/    presentation/
│  │  └─ paymentService.js       ◄─┤       │  │  ├─ makeorder/          business/
│  ├─ persistence/   8 repositórios│       │  │  ├─ delivery/           persistence/ (com schema.sql)
│  │  ├─ db.js                     │       │  │  └─ recipes/
│  │  ├─ catalogRepository.js    ◄─┤       │  ├─ web/      webController.js · public/ (interface)
│  │  └─ orderRepository.js      ◄─┘       │  ├─ app.js    (liga os módulos pelas APIs públicas)
│  ├─ app.js     (liga as camadas)         │  └─ server.js
│  └─ server.js                            ├─ scripts/  demo.js · check-modules.js
├─ scripts/  demo.js · check-layers.js     └─ test/     checkout.test.js
└─ test/     checkout.test.js
```

À esquerda, o checkout está **espalhado** (*smeared*) por quatro sítios. À direita, está **contido** num módulo. É o slide 8, em código. O mesmo vale para cada um dos outros componentes: na versão Layered, cada um está repartido por três pastas (controller, serviço, repositório) e pelo `schema.sql` comum.

O código de negócio é igual nas duas versões: o que muda são as pastas, os `import` e o nome de algumas tabelas. Vale a pena mostrá-lo com um `diff` entre `layered/src/business/checkoutService.js` e `modular/src/modules/catalogcheckout/business/checkoutService.js`: só a linha do `import` difere.

### Quem chama quem

```text
CatalogCheckout ──► Location          (a loja existe e está aberta?)
                ──► Promotion         (o código é válido? regista a utilização)
                ──► Delivery          (taxa e prazo; agenda a entrega)
                ──► ManageInventory ──► Recipes   (que ingredientes leva cada sandes?)
                ──► MakeOrder         (bilhete para a cozinha)
                ──► gateway de pagamento (simulado)
```

Nas duas versões as dependências são injetadas em `app.js`. Na versão modular, cada módulo só recebe a **API pública** (`index.js`) dos outros. Por exemplo, o ManageInventory recebe `recipes.get` e mais nada.

### Dados

- **Layered:** um `schema.sql` único para toda a aplicação, com **chaves estrangeiras entre componentes**. Por exemplo, `kitchen_ticket.order_id → customer_order` e `stock_level.store_id → store`. É a tendência que o livro aponta ao corte técnico: uma base de dados partilhada, difícil de separar mais tarde.
- **Modular:** a base de dados física é a mesma, mas cada módulo cria e é dono das suas tabelas (`modules/*/persistence/schema.sql`). Entre módulos **não há chaves estrangeiras**: `store_id` e `order_id` são só valores. Quando a cozinha precisa dos artigos, recebe uma cópia no bilhete, em vez de os ler das tabelas do checkout. É mais trabalho, mas permite extrair um módulo sem desfazer o esquema.

| Componente | Tabelas (Layered) | Tabelas (Modular) |
|---|---|---|
| CatalogCheckout | `sandwich`, `store_menu`, `customer_order`, `order_line` | `checkout_*` |
| Location | `store` | `location_store` |
| Recipes | `recipe_ingredient` | `recipe_ingredient` |
| ManageInventory | `stock_level`, `stock_reservation`, `stock_reservation_line` | `inventory_stock_*` |
| Promotion | `promotion_code`, `promotion_redemption` | os mesmos |
| MakeOrder | `kitchen_ticket`, `kitchen_ticket_item` | os mesmos |
| Delivery | `delivery_zone`, `delivery_job` | os mesmos |

### Personalização local (slide 10)

A personalização por loja aparece em vários componentes:

- **Catálogo:** a francesinha só existe no Porto, a bifana custa mais em Lisboa e o prego não se vende em Lisboa (`store_menu`).
- **Stock:** só o Porto tem linguiça e molho de francesinha (`stock_level`).
- **Promoções:** `PORTO15` só é válido nos Aliados (`promotion_code.store_id`).
- **Entregas:** Coimbra não faz entregas (`delivery_zone`).

Isto ilustra a desvantagem do corte por domínio que o livro refere: o código de personalização **aparece em vários sítios**.

Nota: o slide 7 usa o corte técnico clássico (camadas). A Fig. 9-6 do livro mostra outra variante técnica, com *Common* e *Local* como componentes de topo; não está implementada aqui.

## Terceira variante: Big Ball of Mud (`big-ball-of-mud/`)

A mesma aplicação **sem arquitetura**. Faz exatamente o mesmo (mesmas rotas, mesmas respostas, mesma interface, mesmos dados) e passa nos **mesmos 9 testes**: o ficheiro de testes só difere na linha do `import`. Mas está tudo num só ficheiro, numa só classe: `src/SiliconSandwiches.js` (cerca de 1000 linhas).

```text
big-ball-of-mud/
├─ src/SiliconSandwiches.js   ← servidor, router, HTML, CSS, JS do browser, negócio, SQL, esquema, dados, demo, reset
├─ scripts/check-mud.js       ← "fitness function" que só pode falhar
└─ test/checkout.test.js      ← os mesmos testes das outras versões
```

Os anti-padrões estão assinalados no código com comentários `LAMA:`. Os principais:

- **A interface vai diretamente à base de dados.** `renderPage()` monta o HTML em strings com os `SELECT` lá dentro: as lojas, os códigos promocionais, a cozinha e as entregas chegam à página já preenchidos, sem passar por nenhum serviço.
- **O código do browser vive na mesma classe que o SQL.** `SiliconSandwiches.browser` é uma função enviada ao browser com `Function.prototype.toString`, e volta a desenhar a cozinha e as entregas de outra maneira (duplicação).
- **Regras de negócio duplicadas.** O preço com personalização local está escrito em SQL em `menu()` e outra vez em JavaScript em `doCheckout()`. Se uma mudar e a outra não, o menu mostra um preço e o checkout cobra outro.
- **Sem fronteiras entre componentes.** `doCheckout()` faz o trabalho dos sete componentes num só método. A cozinha não tem tabela própria de artigos: lê `order_line`, a tabela do checkout. Encomenda, código, bilhete e entrega gravam-se numa só transação, o que é cómodo hoje e impede separá-los amanhã.
- **HTTP misturado com negócio.** As regras lançam erros com `status: 422` e `status: 404`; não há uma camada que traduza.
- **SQL por concatenação**, com aspas escapadas à mão (`q()`), ao lado de consultas parametrizadas: duas formas de fazer o mesmo.
- **Copiar e colar** (o "upsert" de stock aparece três vezes), um `switch` para a máquina de estados, uma lista de rotas escrita à mão, uma cache global sem invalidação.
- **Um ficheiro que é biblioteca e programa ao mesmo tempo:** `npm start`, `npm run demo` e `npm run reset:db` correm todos a mesma classe, com `--demo` e `--reset`.

`npm run check:arch` não tem camadas nem módulos para verificar: conta as responsabilidades que vivem no mesmo ficheiro (HTTP, HTML, CSS, DOM, negócio, SQL, dados, linha de comandos) e **falha**.

O ponto para a aula: funcionar não chega. Perguntar aos alunos onde mexer para fazer os exercícios abaixo nesta versão. A resposta é sempre a mesma (o ficheiro todo), e não há nenhuma regra automática que impeça a próxima mudança de piorar as coisas.

## O fluxo do checkout

`POST /checkout` → `checkoutService.checkout()`:

1. A loja existe e está aberta? (*Location*)
2. Preços do menu da loja, com personalização local (*Catalog*)
3. O código promocional é válido nesta loja, para este cliente? (*Promotion*)
4. A loja faz entregas? Qual é a taxa? (*Delivery*)
5. Reservar os ingredientes: as sandes são convertidas em ingredientes pelas receitas (*ManageInventory* → *Recipes*)
6. Cobrar (gateway de pagamento simulado: o cliente `sem-saldo` é recusado). Se falhar, a reserva de stock é desfeita: é uma **compensação**, porque cada componente tem a sua própria transação.
7. Gravar a encomenda e as linhas numa transação SQL
8. Registar o código usado (*Promotion*), criar o bilhete da cozinha (*MakeOrder*) e agendar a entrega (*Delivery*)

Depois do checkout:

- Os **bilhetes da cozinha** avançam por `QUEUED → PREPARING → READY → COLLECTED`.
- As **entregas** avançam por `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`.

## Interface web

Uma página simples (HTML, CSS e JavaScript sem dependências) que só fala com o servidor pela API HTTP:

1. **Escolher a loja.** Coimbra aparece como fechada, mas pode ser escolhida para se ver o erro.
2. **Menu** com os preços dessa loja e um botão "ver ingredientes" (*Recipes*).
3. **Carrinho e checkout:** cliente, levantamento ou entrega, código promocional. Os códigos aparecem como botões; ao passar o rato, mostra-se a descrição.
4. **Bastidores:**
   - a cozinha e as entregas, com botões **avançar ›** para mudar de estado;
   - o stock da loja escolhida, a vermelho abaixo de 10 unidades;
   - os pedidos HTTP feitos pela página;
   - a arquitetura da versão em uso.

A cor de destaque muda com o estilo: **azul** no Layered, **violeta** no Modular.

O carrinho mantém-se quando se muda de loja. Assim dá para mostrar a personalização local: pôr uma francesinha no carrinho no Porto, mudar para Lisboa e finalizar. A página avisa que o artigo não existe nesse menu e o servidor responde **422**.

Onde vive a interface em cada versão:

- **Layered:** `src/presentation/web/`, servida por `presentation/webController.js`. É mais uma peça da camada de apresentação.
- **Modular:** `src/web/public/`, servida por `src/web/webController.js`. É uma só interface para todos os módulos e fala com eles pela API HTTP. É a situação habitual num monólito modular: o *back-end* está partido por domínio e o *front-end* continua a ser uma peça única.

## Pedidos HTTP

No PowerShell, usar `curl.exe` (não o alias `curl`):

```powershell
curl.exe http://localhost:3000/stores/porto-aliados/menu
curl.exe -X POST http://localhost:3000/checkout -H "Content-Type: application/json" `
  -d '{\"storeId\":\"porto-aliados\",\"customerId\":\"ana\",\"items\":[{\"sandwichId\":\"francesinha\",\"quantity\":1}],\"promoCode\":\"PORTO15\",\"fulfilment\":\"delivery\",\"address\":\"Rua de Santa Catarina, 100\"}'
curl.exe http://localhost:3000/inventory/porto-aliados
curl.exe -X POST http://localhost:3000/kitchen/tickets/1/advance
curl.exe -X POST http://localhost:3000/stores/porto-aliados/status -H "Content-Type: application/json" -d '{\"open\":false}'
```

| Rota | Componente |
|---|---|
| `GET /` · `GET /routes` · `GET /health` | interface web · lista de rotas · estado |
| `GET /stores/:storeId/menu` · `POST /checkout` · `GET /orders/:id` | CatalogCheckout |
| `GET /stores` · `POST /stores/:storeId/status` `{open}` | Location |
| `GET /promotions` | Promotion |
| `GET /inventory/:storeId` · `POST /inventory/:storeId/restock` `{ingredient, quantity}` | ManageInventory |
| `GET /recipes/:sandwichId` | Recipes |
| `GET /kitchen/queue?storeId=` · `POST /kitchen/tickets/:id/advance` | MakeOrder |
| `GET /deliveries` · `POST /deliveries/:id/advance` | Delivery |

Erros: 400 (JSON inválido), 402 (pagamento recusado), 404 (não existe), 422 (pedido inválido).

## Ver a base de dados

Com o servidor parado ou a correr, a partir de `layered/` ou `modular/`:

```powershell
node --disable-warning=ExperimentalWarning -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/silicon-sandwiches.db',{readOnly:true});for(const {name} of db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\").all()){console.log('\n== '+name);console.table(db.prepare('SELECT * FROM '+name).all())}"
```

Alternativas com interface gráfica: a extensão **SQLite Viewer** do VS Code (`qwtel.sqlite-viewer`) ou o **DB Browser for SQLite**. Comparar os dois esquemas lado a lado mostra bem a diferença: chaves estrangeiras entre componentes à esquerda, tabelas isoladas por módulo à direita.

## Governação: `npm run check:arch`

Versões mínimas do que na aula se faz com ArchUnit:

- **Layered** (`check-layers.js`): camadas fechadas. *presentation* só importa de *business*; *business* só de *persistence*.
- **Modular** (`check-modules.js`): (1) um módulo só usa outro através do `index.js`; (2) `shared/` não depende de módulos; (3) um módulo só usa as suas tabelas.

Para ver a regra a falhar, acrescentar ao fim de `layered/src/presentation/checkoutController.js`:

```js
import { createOrderRepository } from '../persistence/orderRepository.js';
```

ou, em `modular/src/modules/delivery/business/deliveryService.js`, uma consulta `SELECT * FROM checkout_customer_order`.

- **Big Ball of Mud** (`check-mud.js`): não há regras de dependência para verificar; o script mede a mistura de responsabilidades e falha sempre.

## Exercícios para a aula

1. **Mudança de domínio.** Guardar uma nota na encomenda (por exemplo "sem cebola") e mostrá-la no bilhete da cozinha. Que ficheiros mudam em cada versão?
   - **Layered:** `database/schema.sql`, `persistence/orderRepository.js`, `persistence/kitchenRepository.js`, `business/checkoutService.js` e `business/makeOrderService.js`, espalhados por três pastas de topo.
   - **Modular:** os mesmos ficheiros, mas agrupados em dois módulos (`catalogcheckout/` e `makeorder/`). Em cada um, o `schema.sql` próprio.
2. **Mudança técnica.** Trocar SQLite por PostgreSQL.
   - **Layered:** só `persistence/` e `database/`.
   - **Modular:** `shared/db.js` e a pasta `persistence/` de **cada um** dos sete módulos.
3. **Extração.** Passar *Delivery* para um serviço separado. Em que versão é mais fácil, e porquê?
   - **Modular:** o módulo já tem fronteira (`index.js`) e não há chaves estrangeiras para as suas tabelas. Basta trocar a API em memória por um cliente HTTP em `app.js` e mover as duas tabelas.
   - **Layered:** primeiro é preciso encontrar o código nas três camadas e desfazer as chaves estrangeiras de `delivery_job` e `delivery_zone`.
4. **Compensação.** O checkout grava a encomenda e depois cria o bilhete da cozinha. O que acontece se o servidor falhar entre os dois passos? E se fosse uma única transação, que versão o permitiria com menos esforço?
5. **Personalização.** Se a regra mais volátil fosse "cada loja tem o seu menu, o seu stock e as suas promoções", onde a poriam em cada versão?

Ligações: [[Aula 5 Script]] · [[Capítulos 9 a 11 - Fundamentos, Layered e Modular Monolith (Richards)]]
