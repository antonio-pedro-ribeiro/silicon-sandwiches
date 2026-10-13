# Silicon Sandwiches · histórias de utilizador

Histórias extraídas do código. As quatro versões (`layered/`, `modular/`, `modular-with-two-packages/` e `big-ball-of-mud/`) implementam as mesmas histórias e passam nos mesmos testes. Os critérios de aceitação vêm das regras de negócio e dos dados de exemplo.

**Atores**

| Ator | Quem é |
|---|---|
| Cliente | Encomenda sandes pela interface web ou pela API |
| Gerente de loja | Abre e fecha a loja e repõe o stock |
| Cozinha | Prepara as encomendas da loja |
| Estafeta | Faz as entregas ao domicílio |

As histórias marcadas com **(só API)** não têm botão na interface web.

---

## Location · lojas

### US-01 · Ver as lojas
**Como** cliente, **quero** ver a lista de lojas, com a cidade e se estão abertas, **para** escolher onde encomendar.

- `GET /stores` devolve todas as lojas, com o campo `open`.
- Na interface, as lojas fechadas aparecem assinaladas como "fechada".

### US-02 · Abrir e fechar uma loja (só API)
**Como** gerente de loja, **quero** abrir ou fechar a minha loja, **para** deixar de receber encomendas quando não posso atender.

- `POST /stores/:storeId/status` com `{ "open": true | false }`.
- `open` que não seja booleano → 422. Loja desconhecida → 404.
- Com a loja fechada, o checkout é recusado (ver US-08).

---

## CatalogCheckout · menu e encomendas

### US-03 · Ver o menu de uma loja
**Como** cliente, **quero** ver o menu e os preços da loja que escolhi, **para** saber o que posso encomendar e quanto custa.

- `GET /stores/:storeId/menu` devolve o catálogo comum com as variações dessa loja:
  - preço local (a bifana custa 4,80 € em Lisboa e 4,50 € no resto);
  - artigo indisponível (o prego não se vende em Lisboa);
  - artigo exclusivo (a francesinha só existe no Porto, a 6,50 €).

### US-04 · Ver a receita de uma sandes
**Como** cliente, **quero** ver os ingredientes de uma sandes, **para** saber o que vou comer.

- `GET /recipes/:sandwichId` devolve os ingredientes, com quantidade e unidade.
- Sandes sem receita → 404.

### US-05 · Montar o carrinho
**Como** cliente, **quero** juntar sandes ao carrinho e mudar as quantidades, **para** preparar a encomenda antes de pagar.

- O carrinho guarda só a sandes e a quantidade. O preço vem sempre do menu da loja escolhida.
- A interface mostra um subtotal estimado.
- No checkout, linhas repetidas da mesma sandes são somadas.

### US-06 · Escolher levantamento ou entrega
**Como** cliente, **quero** escolher entre levantar na loja ou receber em casa, **para** receber a encomenda da forma que me dá mais jeito.

- `fulfilment` é `pickup` (por omissão) ou `delivery`. Outro valor → 422.
- A entrega precisa de morada. Sem morada → 422.

### US-07 · Usar um código promocional
**Como** cliente, **quero** aplicar um código promocional, **para** pagar menos.

- `GET /promotions` lista os códigos ativos. Na interface, aparecem como atalhos junto ao campo.
- O desconto é uma percentagem do subtotal ou um valor fixo (nunca maior do que o subtotal).
- O código é recusado (422) quando:
  - não existe;
  - só vale noutra loja (`PORTO15` só nos Aliados);
  - o subtotal está abaixo do mínimo (`MENOS1` só acima de 10 €);
  - o cliente já o usou o número máximo de vezes (`BEMVINDO` só uma vez por cliente).
- Cada utilização fica registada depois de a encomenda ser gravada.

### US-08 · Finalizar a encomenda (checkout)
**Como** cliente, **quero** finalizar a encomenda e pagar, **para** que a loja a prepare.

- `POST /checkout` com `storeId`, `customerId`, `items`, e opcionalmente `promoCode`, `fulfilment` e `address`.
- Total = subtotal − desconto + taxa de entrega.
- Responde 201 com a encomenda gravada (estado `PLACED`, referência do pagamento).
- É recusado quando:
  - o pedido não é JSON válido → 400;
  - falta `storeId`, `customerId` ou artigos, ou uma quantidade não é inteira positiva → 422;
  - a loja não existe → 404;
  - a loja está fechada → 422;
  - uma sandes não está no menu da loja → 422;
  - o código promocional não é válido → 422 (US-07);
  - a loja não faz entregas e foi pedida entrega → 422 (US-14);
  - não há ingredientes suficientes → 422 (US-11);
  - o pagamento é recusado → 402 (US-09).

### US-09 · Ser avisado de um pagamento recusado
**Como** cliente, **quero** saber que o pagamento foi recusado, **para** tentar outra vez ou usar outro meio.

- O gateway de pagamento é externo e está simulado: recusa o cliente `sem-saldo`.
- Com o pagamento recusado, a resposta é 402, a encomenda não é gravada e os ingredientes reservados voltam ao stock.

### US-10 · Consultar uma encomenda
**Como** cliente, **quero** consultar uma encomenda pelo número, **para** ver o que encomendei e quanto paguei.

- `GET /orders/:id` devolve as linhas, o subtotal, o desconto, a taxa de entrega e o total.
- Encomenda inexistente → 404.

---

## ManageInventory · stock

### US-11 · Reservar os ingredientes de cada encomenda
**Como** gerente de loja, **quero** que cada encomenda gaste os ingredientes das suas receitas, **para** não vender o que não consigo fazer.

- No checkout, as sandes são convertidas em ingredientes através das receitas (Recipes) e reservadas no stock da loja.
- Se faltar algum ingrediente, a encomenda é recusada (422) e nada é gasto.
- Se o pagamento falhar depois da reserva, a reserva é desfeita.

### US-12 · Ver o stock de uma loja
**Como** gerente de loja, **quero** ver as quantidades de cada ingrediente, **para** saber o que está a acabar.

- `GET /inventory/:storeId` devolve os ingredientes e as quantidades.
- Na interface, o stock da loja escolhida aparece nos bastidores.

### US-13 · Repor stock (só API)
**Como** gerente de loja, **quero** acrescentar unidades de um ingrediente, **para** voltar a vender as sandes que o usam.

- `POST /inventory/:storeId/restock` com `{ "ingredient", "quantity" }`.
- Falta `ingredient`, ou `quantity` não é inteira positiva → 422.

---

## Delivery · entregas

### US-14 · Saber a taxa de entrega
**Como** cliente, **quero** que a taxa de entrega da loja seja somada ao total, **para** saber quanto vou pagar.

- Cada loja com entregas tem uma taxa e um tempo estimado (Lisboa 3,00 € / 35 min; Porto 2,50 € / 30 min).
- Coimbra não faz entregas: pedir entrega lá → 422.
- No `modular-with-two-packages/`, se o serviço de entregas não responder, a entrega dá 503 e o levantamento na loja continua a funcionar.

### US-15 · Agendar a entrega
**Como** estafeta, **quero** que cada encomenda com entrega gere uma entrega com morada e tempo estimado, **para** saber o que tenho de levar e onde.

- Depois de gravada a encomenda, é criada uma entrega no estado `SCHEDULED`.

### US-16 · Acompanhar e avançar as entregas
**Como** estafeta, **quero** ver as entregas e marcar o seu progresso, **para** que a loja e o cliente saibam onde está a encomenda.

- `GET /deliveries` lista as entregas.
- `POST /deliveries/:id/advance` avança `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`.
- Entrega inexistente → 404. Entrega já concluída → 422.

---

## MakeOrder · cozinha

### US-17 · Receber as encomendas na cozinha
**Como** cozinha, **quero** receber um bilhete por cada encomenda paga, com as sandes e as quantidades, **para** saber o que preparar.

- Depois de gravada a encomenda, é criado um bilhete no estado `QUEUED`.
- `GET /kitchen/queue?storeId=` lista os bilhetes (de uma loja ou de todas).

### US-18 · Avançar o estado de um bilhete
**Como** cozinha, **quero** marcar o progresso de cada bilhete, **para** saber o que está em preparação, pronto ou levantado.

- `POST /kitchen/tickets/:id/advance` avança `QUEUED → PREPARING → READY → COLLECTED`.
- Bilhete inexistente → 404. Bilhete já levantado → 422.

---

## Resumo

| ID | História | Ator | Componente | Rota |
|---|---|---|---|---|
| US-01 | Ver as lojas | Cliente | Location | `GET /stores` |
| US-02 | Abrir e fechar uma loja | Gerente | Location | `POST /stores/:storeId/status` |
| US-03 | Ver o menu de uma loja | Cliente | CatalogCheckout | `GET /stores/:storeId/menu` |
| US-04 | Ver a receita de uma sandes | Cliente | Recipes | `GET /recipes/:sandwichId` |
| US-05 | Montar o carrinho | Cliente | interface web | — |
| US-06 | Escolher levantamento ou entrega | Cliente | CatalogCheckout | `POST /checkout` |
| US-07 | Usar um código promocional | Cliente | Promotion | `GET /promotions` · `POST /checkout` |
| US-08 | Finalizar a encomenda | Cliente | CatalogCheckout | `POST /checkout` |
| US-09 | Ser avisado de um pagamento recusado | Cliente | CatalogCheckout (pagamento simulado) | `POST /checkout` |
| US-10 | Consultar uma encomenda | Cliente | CatalogCheckout | `GET /orders/:id` |
| US-11 | Reservar os ingredientes | Gerente | ManageInventory · Recipes | `POST /checkout` |
| US-12 | Ver o stock de uma loja | Gerente | ManageInventory | `GET /inventory/:storeId` |
| US-13 | Repor stock | Gerente | ManageInventory | `POST /inventory/:storeId/restock` |
| US-14 | Saber a taxa de entrega | Cliente | Delivery | `POST /checkout` |
| US-15 | Agendar a entrega | Estafeta | Delivery | `POST /checkout` |
| US-16 | Acompanhar e avançar as entregas | Estafeta | Delivery | `GET /deliveries` · `POST /deliveries/:id/advance` |
| US-17 | Receber as encomendas na cozinha | Cozinha | MakeOrder | `GET /kitchen/queue` |
| US-18 | Avançar o estado de um bilhete | Cozinha | MakeOrder | `POST /kitchen/tickets/:id/advance` |
