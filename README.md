# Silicon Sandwiches · várias formas de organizar o mesmo sistema

O mesmo sistema, com a mesma funcionalidade, organizado de várias formas:

| Pasta | Organização | Estilo | Porta |
|---|---|---|---|
| `layered/` | Técnica: *presentation · business · persistence · database* | Layered | 3000 |
| `modular/` | Por domínio: um módulo por componente do kata | Modular Monolith | 3001 |
| `modular-deployment/` | Por domínio, em dois pacotes de deployment (o Delivery à parte) | Modular, 2 deployments | 3003 · 3004 |
| `big-ball-of-mud/` | Nenhuma: tudo numa só classe | Big Ball of Mud (anti-padrão) | 3002 |

Estão implementados todos os componentes do kata, com base de dados SQL: *CatalogCheckout*, *Location*, *Promotion*, *ManageInventory*, *MakeOrder*, *Delivery* e *Recipes*. Só o gateway de pagamento é simulado, porque representa um sistema externo. Os dados (lojas, preços, stocks, códigos) são inventados.

## Arranque

Node **22.13 ou superior**, sem dependências (`node:http` e `node:sqlite`). Não é preciso `npm install`.

```powershell
cd layered          # ou modular, ou big-ball-of-mud
npm run demo        # 9 checkouts na consola, com a BD em memória
npm test            # 9 testes (os mesmos em todas as versões)
npm run check:arch  # verifica as regras de dependência
npm run reset:db    # apaga encomendas e afins; mantém o catálogo
npm start           # servidor + interface web; BD em data/silicon-sandwiches.db
```

Depois do `npm start`, abrir http://localhost:3000, http://localhost:3001 ou http://localhost:3002. Para voltar aos dados de exemplo, apagar a pasta `data/`.

O `modular-deployment/` tem os mesmos comandos, mas arranca dois processos e serve a interface em http://localhost:3003. As instruções estão em [modular-deployment/README.md](modular-deployment/README.md).

## Layered vs. Modular

```text
layered/                                   modular/
├─ database/  schema.sql · seed.sql        ├─ src/
├─ src/                                    │  ├─ shared/   http.js · db.js · errors.js · mockLog.js
│  ├─ presentation/  controllers · web/    │  ├─ modules/
│  ├─ business/      serviços              │  │  ├─ catalogcheckout/   index.js · presentation/ · business/ · persistence/
│  ├─ persistence/   repositórios          │  │  ├─ location/ · promotion/ · manageinventory/
│  ├─ app.js     (liga as camadas)         │  │  └─ makeorder/ · delivery/ · recipes/
│  └─ server.js                            │  ├─ web/      interface
├─ scripts/  demo · check-layers           │  └─ app.js    (liga os módulos pelas APIs públicas)
└─ test/                                   ├─ scripts/  demo · check-modules
                                           └─ test/
```

- **Layered:** cada componente está espalhado por três pastas (controller, serviço, repositório) e por um `schema.sql` comum, com chaves estrangeiras entre componentes.
- **Modular:** cada componente está contido num módulo, que só expõe o `index.js` e é dono das suas tabelas. Entre módulos não há chaves estrangeiras.

O código de negócio é o mesmo nas duas: um `diff` entre `layered/src/business/checkoutService.js` e `modular/src/modules/catalogcheckout/business/checkoutService.js` só mostra a linha do `import`.

## Modular com dois pacotes de deployment

O `modular/` tem sete módulos, mas é **um só** pacote de deployment: um `package.json`, um processo e uma base de dados. O `modular-deployment/` tira o módulo Delivery para um segundo pacote, com o seu processo e a sua base de dados. Os dois pacotes falam por HTTP.

- O módulo Delivery e o CatalogCheckout não mudam. No pacote principal, `modules/delivery/index.js` passa a ser um cliente HTTP com a mesma API pública.
- Com o Delivery desligado, o levantamento na loja continua a funcionar e a entrega ao domicílio responde 503.
- `npm run check:arch` verifica também que nenhum pacote importa código do outro.

## Big Ball of Mud

A mesma aplicação sem arquitetura: tudo em `big-ball-of-mud/src/SiliconSandwiches.js`, uma só classe com servidor, router, HTML, CSS, JavaScript do browser, regras de negócio, SQL, esquema e dados. Passa nos mesmos testes e dá as mesmas respostas HTTP.

Os anti-padrões estão assinalados no código com `LAMA:`. Por exemplo:

- a página é gerada com `SELECT`s dentro do HTML (a interface vai diretamente à base de dados);
- o JavaScript do browser vive na mesma classe que o SQL;
- a regra do preço por loja está escrita duas vezes, em SQL e em JavaScript;
- o checkout faz o trabalho dos sete componentes num só método, e a cozinha lê as tabelas do checkout;
- os códigos HTTP vêm de dentro das regras de negócio;
- há SQL por concatenação, código copiado e colado e uma cache global.

Aqui, `npm run check:arch` não tem fronteiras para verificar: conta as responsabilidades misturadas no mesmo ficheiro e falha.

## O checkout

`POST /checkout`:

1. A loja existe e está aberta? (*Location*)
2. Preços do menu da loja (*Catalog*)
3. O código promocional é válido? (*Promotion*)
4. A loja faz entregas e qual é a taxa? (*Delivery*)
5. Reservar os ingredientes, segundo as receitas (*ManageInventory* → *Recipes*)
6. Cobrar. O cliente `sem-saldo` é recusado e a reserva de stock é desfeita.
7. Gravar a encomenda
8. Registar o código usado, criar o bilhete da cozinha e agendar a entrega

Depois, os bilhetes da cozinha avançam por `QUEUED → PREPARING → READY → COLLECTED` e as entregas por `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`.

### Personalização por loja

- A francesinha só existe no Porto, a bifana é mais cara em Lisboa e o prego não se vende em Lisboa.
- Só o Porto tem linguiça e molho de francesinha.
- `PORTO15` só é válido nos Aliados.
- Coimbra está fechada e não faz entregas.

## Interface web

Escolher a loja, ver o menu e as receitas, montar o carrinho e finalizar. Os bastidores mostram a cozinha, as entregas, o stock e os pedidos HTTP. A cor de destaque indica a versão: azul (Layered), violeta (Modular), azul-petróleo (Modular com dois deployments) ou castanho (Big Ball of Mud).

## API

| Rota | Componente |
|---|---|
| `GET /` · `GET /routes` · `GET /health` | interface · lista de rotas · estado |
| `GET /stores/:storeId/menu` · `POST /checkout` · `GET /orders/:id` | CatalogCheckout |
| `GET /stores` · `POST /stores/:storeId/status` `{open}` | Location |
| `GET /promotions` | Promotion |
| `GET /inventory/:storeId` · `POST /inventory/:storeId/restock` `{ingredient, quantity}` | ManageInventory |
| `GET /recipes/:sandwichId` | Recipes |
| `GET /kitchen/queue?storeId=` · `POST /kitchen/tickets/:id/advance` | MakeOrder |
| `GET /deliveries` · `POST /deliveries/:id/advance` | Delivery |

Erros: 400 (JSON inválido), 402 (pagamento recusado), 404 (não existe), 422 (pedido inválido) e, só no `modular-deployment/`, 503 (o serviço Delivery não responde).

Exemplo em PowerShell (usar `curl.exe`, não o alias `curl`):

```powershell
curl.exe -X POST http://localhost:3000/checkout -H "Content-Type: application/json" `
  -d '{\"storeId\":\"porto-aliados\",\"customerId\":\"ana\",\"items\":[{\"sandwichId\":\"francesinha\",\"quantity\":1}],\"promoCode\":\"PORTO15\",\"fulfilment\":\"delivery\",\"address\":\"Rua de Santa Catarina, 100\"}'
```

A base de dados (`data/silicon-sandwiches.db`) pode ser aberta com a extensão **SQLite Viewer** do VS Code ou com o **DB Browser for SQLite**.

## Verificação das regras: `npm run check:arch`

- **Layered:** *presentation* só importa de *business*, e *business* só de *persistence*.
- **Modular:** um módulo só usa outro através do `index.js`, `shared/` não depende de módulos e cada módulo só usa as suas tabelas.
- **Big Ball of Mud:** não há regras para verificar, por isso falha sempre.

Para ver uma regra a falhar, acrescentar `import { createOrderRepository } from '../persistence/orderRepository.js';` a `layered/src/presentation/checkoutController.js`.

## Exercícios

1. **Mudança de domínio:** guardar uma nota na encomenda ("sem cebola") e mostrá-la na cozinha. Que ficheiros mudam em cada versão?
2. **Mudança técnica:** trocar SQLite por PostgreSQL. Onde se mexe?
3. **Extração:** passar *Delivery* para um serviço separado. Em que versão é mais fácil? (O `modular-deployment/` é uma resposta possível para a versão modular.)
4. **Compensação:** o que acontece se o servidor falhar entre gravar a encomenda e criar o bilhete da cozinha?
5. **Big Ball of Mud:** repetir o exercício 1 na terceira versão. O que torna a mudança mais difícil, se o código funciona?
