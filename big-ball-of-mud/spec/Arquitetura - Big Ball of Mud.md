#fcul

# Silicon Sandwiches · Big Ball of Mud · diagramas de arquitetura

Quatro vistas do código em `big-ball-of-mud/`, na mesma ordem e com as mesmas cores de [Arquitetura - Layered](../../layered/spec/Arquitetura%20-%20Layered.md) e [Arquitetura - Modular](../../modular/spec/Arquitetura%20-%20Modular.md), para as comparar lado a lado.

- **Mermaid** (esta nota): vê-se diretamente no Obsidian, no GitHub e no VS Code.
- **draw.io**: `Arquitetura - Big Ball of Mud.drawio`, nesta pasta, com as mesmas quatro vistas em quatro páginas. É a versão para editar.

**Cor = componente do kata**, igual em todas as versões:

| Cor | Componente |
|---|---|
| 🟨 amarelo | CatalogCheckout |
| 🟦 azul | Location |
| 🩷 rosa | Promotion |
| 🟩 verde | ManageInventory |
| 🟧 laranja | MakeOrder |
| 🟪 roxo | Delivery |
| 🩵 ciano | Recipes |
| ⬜ cinzento | técnico / partilhado |

Aqui, as cores não têm onde ficar: os componentes do kata não existem no código. As caixas são cinzentas e os quadrados ao lado dizem que componentes cada parte da classe mexe.

---

## 1 · Particionamento de topo

**Não há** particionamento. A pasta `src/` tem um ficheiro, e o ficheiro tem uma classe com 975 linhas. A classe está dividida por posição (lê-se coluna a coluna, pelos números das linhas), não por responsabilidade: quase todas as partes tocam em quase todas as cores.

```mermaid
flowchart TB
  subgraph F["src/SiliconSandwiches.js · 975 linhas · 1 classe"]
    direction TB
    a["constructor · q() · esc() · linhas 17–60<br/>abre a BD, cria o esquema, carrega os dados, SQL por concatenação<br/>🟨🟦🩷🟩🟧🟪🩵"]:::tech
    b["handle(req, res) · linhas 62–218<br/>servidor HTTP + router (um if por rota) + regras + SQL<br/>🟨🟦🩷🟩🟧🟪🩵"]:::tech
    c["ticket() · menu() · getOrder() · linhas 221–268<br/>🟧🟨"]:::tech
    d["doCheckout() · linhas 270–402<br/>o trabalho dos sete componentes num só método<br/>🟨🟦🩷🟩🟧🟪🩵"]:::tech
    e["renderPage() · linhas 404–530<br/>HTML em strings, com SELECTs lá dentro<br/>🟦🩷🟧🟨🟪"]:::tech
    f["static browser · linhas 533–722<br/>JavaScript que corre no browser (DOM, fetch)<br/>🟨🟦🩷🟩🟧🟪🩵"]:::tech
    g["static main · linhas 723–783<br/>linha de comandos: servidor, --demo, --reset"]:::tech
    h["static SCHEMA · SEED · CSS · linhas 785–975<br/>14 tabelas sem FK · dados de exemplo · estilos"]:::tech
  end
  db[("SQLite · data/silicon-sandwiches.db<br/>uma base de dados para tudo")]:::tech

  a ~~~ b ~~~ c ~~~ d
  e ~~~ f ~~~ g ~~~ h
  F --> db

  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

Fora da classe ficam só os testes (`test/checkout.test.js`, os 9 de sempre) e `scripts/check-mud.js`.

> **Perguntar:** "Quero mudar a forma como se calcula a taxa de entrega e guardar mais um campo. Quantas pastas abro?" → Uma pasta e um ficheiro, mas pelo menos quatro sítios desse ficheiro: o `SCHEMA` (a coluna), o `doCheckout()` (a regra), o `handle()` (o `GET /deliveries` e o `POST /deliveries/:id/advance` mapeiam as colunas à mão, duas vezes) e o `renderPage()` (o `SELECT` da página). Nada no código diz que são estes quatro: é preciso procurar.

---

## 2 · Regras de dependência

**Não há regras para verificar.** Qualquer linha da classe pode usar qualquer outra e qualquer tabela. `scripts/check-mud.js` (`npm run check:arch`) conta, em vez disso, quantas responsabilidades diferentes vivem no mesmo ficheiro, e falha sempre:

| Responsabilidade | Ocorrências em `SiliconSandwiches.js` |
|---|---|
| HTTP (pedidos e respostas) | 4 |
| Router (rotas) | 16 |
| HTML | 221 |
| CSS | 69 |
| JavaScript do browser (DOM) | 8 |
| Regras de negócio | 32 |
| SQL | 77 |
| Dados de exemplo | 18 |
| Linha de comandos | 5 |

`✘ 9 responsabilidades no mesmo ficheiro: não há fronteiras para verificar.` (Resultado de correr o script.)

O diagrama mostra os atalhos assinalados no código com `LAMA:`. Cada seta vermelha é uma dependência que, no Layered ou no Modular, o `check:arch` rejeitava.

```mermaid
flowchart TB
  browser["static browser<br/>JS do browser"]:::tech
  handle["handle()<br/>HTTP + router"]:::tech
  page["renderPage()<br/>HTML"]:::tech
  checkout["doCheckout()<br/>regras de negócio"]:::tech
  menu["menu()<br/>regra do preço em SQL"]:::tech
  ticket["ticket()<br/>cozinha"]:::tech
  db[("SQLite · 14 tabelas")]:::tech
  ol["tabela order_line<br/>(do checkout)"]:::cc

  browser -->|"fetch (o código vive na mesma classe que o SQL)"| handle
  handle --> page
  handle --> checkout
  page -->|"SELECT dentro do HTML"| db
  checkout -->|"SQL por concatenação"| db
  checkout -.-|"a mesma regra do preço, outra vez em JS"| menu
  checkout -->|"err.status: o código HTTP vem da regra"| handle
  ticket -->|"a cozinha lê as linhas da encomenda"| ol
  handle -->|"upsert do stock copiado e colado"| db

  linkStyle 3,4,5,6,7,8 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef tech fill:#E5E7EB,stroke:#4B5563,color:#111
```

> **Perguntar:** "Se o código funciona e passa nos mesmos 9 testes, qual é o problema?" → Os testes dizem o que o sistema faz, não o custo de o mudar. Sem fronteiras, cada mudança obriga a abrir, perceber e testar a classe inteira. E as regras duplicadas (o preço em SQL e em JavaScript, a máquina de estados no servidor e no browser) divergem sem que nenhum teste dê por isso.

---

## 3 · Sequência do checkout

`POST /checkout` entra em `handle()` e corre todo dentro de `doCheckout()`, que vai diretamente às tabelas. Não há serviços nem repositórios: as faixas coloridas mostram de que componente do kata é cada passo, mas no código são só linhas seguidas do mesmo método.

```mermaid
sequenceDiagram
  actor C as Cliente (browser)
  box rgba(128,128,128,0.12) SiliconSandwiches.js
    participant H as handle()
    participant CK as doCheckout()
  end
  box rgba(128,128,128,0.12) database
    participant DB as SQLite · 14 tabelas
  end

  C->>H: POST /checkout
  H->>CK: doCheckout(body)
  Note over CK: valida o pedido (throw … status 422)
  rect rgba(191,219,254,0.45)
    CK->>DB: SELECT * FROM store WHERE id = '…' (concatenação)
  end
  rect rgba(253,230,138,0.45)
    loop por sandes
      CK->>DB: SELECT sandwich · SELECT store_menu
    end
    Note over CK: a regra do preço local, outra vez em JS
  end
  opt há código promocional
    rect rgba(251,207,232,0.45)
      CK->>DB: SELECT promotion_code · COUNT(*) promotion_redemption
    end
  end
  opt entrega ao domicílio
    rect rgba(221,214,254,0.45)
      CK->>DB: SELECT delivery_zone
    end
  end
  rect rgba(165,243,252,0.45)
    CK->>DB: SELECT recipe_ingredient (por sandes)
  end
  rect rgba(187,247,208,0.45)
    CK->>DB: BEGIN · INSERT stock_reservation · UPDATE stock_level … · COMMIT
  end
  Note over CK: pagamento: if (customerId == 'sem-saldo'), o gateway simulado está no mesmo método
  alt pagamento recusado
    rect rgba(187,247,208,0.45)
      CK->>DB: BEGIN · upsert stock_level (copiado) · UPDATE stock_reservation · COMMIT
    end
    CK-->>H: throw { status: 402 }
    H-->>C: 402
  else pagamento aprovado
    CK->>DB: BEGIN
    rect rgba(253,230,138,0.45)
      CK->>DB: INSERT customer_order · order_line
    end
    rect rgba(251,207,232,0.45)
      CK->>DB: INSERT promotion_redemption
    end
    rect rgba(254,215,170,0.45)
      CK->>DB: INSERT kitchen_ticket
    end
    rect rgba(221,214,254,0.45)
      CK->>DB: INSERT delivery_job
    end
    CK->>DB: COMMIT
    CK-->>H: getOrder(id)
    H-->>C: 201 Created
  end
```

> **Perguntar:** "Comparem com a mesma sequência no Layered e no Modular. Os passos mudam?" → Não: são os mesmos oito passos, pela mesma ordem. O que muda é que não há ninguém do outro lado da seta. A encomenda, o código usado, o bilhete e a entrega são gravados numa só transação "porque está tudo à mão" (`LAMA:` na linha 372). É cómodo, mas torna impossível separar o Delivery ou a cozinha mais tarde sem reescrever o método.

---

## 4 · Dados

Um só `static SCHEMA`, com **14 tabelas e nenhuma chave estrangeira**. As relações existem (as mesmas do Layered), mas são só ids guardados (a tracejado): a base de dados não garante nenhuma. Falta a `kitchen_ticket_item`: a cozinha lê diretamente `order_line`, a tabela do checkout (a vermelho). As contagens são minhas, feitas a partir do `SCHEMA`.

```mermaid
flowchart LR
  subgraph S["static SCHEMA · uma base de dados partilhada por tudo"]
    sandwich:::cc
    store_menu:::cc
    customer_order:::cc
    order_line:::cc
    store:::loc
    recipe_ingredient:::rec
    stock_level:::inv
    stock_reservation:::inv
    stock_reservation_line:::inv
    promotion_code:::promo
    promotion_redemption:::promo
    kitchen_ticket:::mo
    delivery_zone:::del
    delivery_job:::del
  end

  %% id do mesmo componente, sem FK (0–4)
  store_menu -.-> sandwich
  order_line -.-> customer_order
  order_line -.-> sandwich
  stock_reservation_line -.-> stock_reservation
  promotion_redemption -.-> promotion_code

  %% id de outro componente, sem FK (5–16)
  store_menu -.-> store
  customer_order -.-> store
  recipe_ingredient -.-> sandwich
  stock_level -.-> store
  stock_reservation -.-> store
  promotion_code -.-> store
  promotion_redemption -.-> customer_order
  kitchen_ticket -.-> customer_order
  kitchen_ticket -.-> store
  delivery_zone -.-> store
  delivery_job -.-> customer_order
  delivery_job -.-> store

  %% a cozinha lê as linhas da encomenda (17)
  kitchen_ticket -->|"ticket() lê os artigos daqui"| order_line

  linkStyle 17 stroke:#B91C1C,stroke-width:2px

  classDef cc fill:#FDE68A,stroke:#B45309,color:#111
  classDef loc fill:#BFDBFE,stroke:#1D4ED8,color:#111
  classDef promo fill:#FBCFE8,stroke:#BE185D,color:#111
  classDef inv fill:#BBF7D0,stroke:#15803D,color:#111
  classDef mo fill:#FED7AA,stroke:#C2410C,color:#111
  classDef del fill:#DDD6FE,stroke:#6D28D9,color:#111
  classDef rec fill:#A5F3FC,stroke:#0E7490,color:#111
```

| | Layered | Modular | Big Ball of Mud |
|---|---|---|---|
| Esquemas | 1 | 7 (um por módulo) | 1, dentro da classe |
| Tabelas | 15 | 15 | 14 |
| Chaves estrangeiras | 18 | 6 | 0 |
| Quem pode ler cada tabela | qualquer repositório | só o módulo dono | qualquer linha da classe |

> **Perguntar:** "No Modular também se tiraram as FK entre componentes. Qual é a diferença?" → No Modular, tirar a FK foi uma decisão: cada tabela tem um dono e só ele lhe mexe (regra 3 do `check:arch`), e o código desse módulo garante a integridade. Aqui não há FK nem dono. A integridade não está em lado nenhum, e qualquer parte da classe pode escrever em qualquer tabela.
