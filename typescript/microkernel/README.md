# Silicon Sandwiches · Microkernel

O mesmo sistema, organizado como um **núcleo** pequeno e estável mais **plug-ins** independentes. O núcleo faz o caminho feliz: o checkout com o catálogo comum, as lojas, o stock, as receitas, a cozinha e as entregas. Os plug-ins isolam o que varia e muda muito: a **personalização de cada loja** e as **regras de cada código promocional**.

| Parte | Pasta | O que tem |
|---|---|---|
| Núcleo | `src/core/` | Os sete módulos do [`modular/`](../modular/) (o núcleo é um monólito modular), o contrato dos plug-ins e a interface web |
| Plug-ins de loja | `src/plugins/store/<loja>/` | Menu local (preço próprio, artigo indisponível, artigo exclusivo) e entregas (taxa e tempo) |
| Plug-ins de promoção | `src/plugins/promotion/<código>/` | A regra de um código: loja, mínimo, limite por cliente, desconto |
| Registo | `src/plugins/registry.ts` | A lista dos plug-ins ativos |
| Raiz de composição | `src/app.ts` | O único ficheiro que conhece o núcleo e os plug-ins |

É um só processo, com uma só base de dados: um único *quantum*, como no `modular/`.

## Como executar

Node **22.13 ou superior**. Para correr não há dependências: o Node tira os tipos ao arrancar (`--experimental-strip-types`). Só a verificação de tipos precisa de `npm install` (instala o `typescript`).

```powershell
cd microkernel
npm run demo        # 9 checkouts na consola, com a BD em memória (mostra primeiro os plug-ins)
npm test            # os 9 testes de sempre + 6 testes dos plug-ins
npm run check:arch  # regras do microkernel (ver abaixo)
npm run typecheck   # verificação de tipos (tsc, modo strict); precisa de npm install
npm run reset:db    # apaga encomendas e afins; mantém o catálogo
npm start           # http://localhost:3005
```

`GET /plugins` lista os plug-ins carregados. Na interface, a cor de destaque é rosa e os bastidores mostram o núcleo e os plug-ins.

## Núcleo e plug-ins

O núcleo não sabe que lojas ou códigos existem. Procura o plug-in no registo e chama-o pelo contrato, sem nenhum `if (loja === 'porto')`:

| Pergunta do núcleo | Quem responde | Sem plug-in |
|---|---|---|
| Qual é o menu da loja X? | `store/X` → `menu(menuComum)` | O menu comum |
| A loja X faz entregas? Quanto custa? | `store/X` → `delivery` | Não faz entregas |
| O código C é válido? Quanto desconta? | `promotion/C` → `evaluate(ctx)` | Código inválido |

Coimbra não tem plug-in: vende o menu comum e não faz entregas. É o caminho feliz.

### Contratos (`src/core/plugins/contracts.ts`)

```ts
export interface StorePlugin {
  name: string; contract: 'store'; storeId: string; description: string;
  menu(common: MenuItem[]): MenuItem[];
  delivery?: { feeCents: number; etaMinutes: number };
}

export interface PromotionPlugin {
  name: string; contract: 'promotion'; code: string; description: string;
  evaluate(ctx: { storeId: string; customerId: string; subtotalCents: number; timesUsed: number }): PromotionResult;
}
```

Cada plug-in declara que cumpre o contrato com `satisfies`, importando só o tipo (`import type`, que desaparece em tempo de execução):

```ts
import type { StorePlugin } from '../../../core/plugins/contracts.ts';

export default {
  name: 'store/porto-aliados', contract: 'store', storeId: 'porto-aliados', description: '…',
  menu: (common) => [...common, { id: 'francesinha', name: 'Francesinha em sandes', priceCents: 650 }],
  delivery: { feeCents: 250, etaMinutes: 30 },
} satisfies StorePlugin;
```

- Os plug-ins **não acedem à base de dados**. O `BEMVINDO` precisa de saber quantas vezes o cliente já usou o código: o núcleo conta as utilizações (tabela `promotion_redemption`) e passa-lhe `timesUsed`.
- O contrato é verificado duas vezes. O `tsc` verifica os plug-ins que estão no código (`npm run typecheck`). No arranque, o núcleo valida cada plug-in que recebe (chegam como `unknown`), porque os tipos desaparecem em tempo de execução. Um plug-in que não cumpre é recusado (`Plug-ins inválidos: promotion/natal: evaluate tem de ser function`).
- O contrato segue a convenção do livro para os nomes: `<contrato>/<contexto>`, que é também a pasta.

### Registo

Os plug-ins são **de tempo de compilação**: entram com o build, pela lista em `src/plugins/registry.ts`. Acrescentar um código promocional é criar `src/plugins/promotion/verao20/index.ts` e juntar uma linha ao registo. Não se mexe no núcleo.

## O que mudou em relação a `modular/`

```text
microkernel/src/
├─ core/                          o núcleo
│  ├─ modules/                    os sete módulos do modular/
│  │  ├─ catalogcheckout/         catalogService pede o menu ao plug-in da loja; sem tabela de menus locais
│  │  ├─ promotion/               discountFor pede a regra ao plug-in do código; só guarda as utilizações
│  │  ├─ delivery/                quote e schedule leem a taxa e o tempo do plug-in da loja; sem tabela de zonas
│  │  └─ location/ · manageinventory/ · makeorder/ · recipes/   iguais
│  ├─ plugins/                    contracts.ts · pluginHost.ts (valida e indexa os plug-ins)
│  ├─ shared/ · web/
├─ plugins/                       os plug-ins
│  ├─ store/        porto-aliados · lisboa-campo-grande
│  ├─ promotion/    fcul10 · menos1 · porto15 · bemvindo
│  └─ registry.ts
└─ app.ts · server.ts
```

- **O `checkoutService.ts` não mudou.** É igual ao do `modular/` (e ao do `layered/`).
- **Saíram três tabelas** (`checkout_store_menu`, `delivery_zone`, `promotion_code`): a personalização deixou de ser dados e passou a ser código, nos plug-ins.
- **A francesinha saiu do catálogo comum** e entrou no plug-in do Porto. Por isso `checkout_order_line.sandwich_id` deixou de ter chave estrangeira para `checkout_sandwich`. A receita dela continua no núcleo (módulo Recipes).

## Verificação das regras: `npm run check:arch`

1. O núcleo (`src/core/`) não importa nada de `src/plugins/`.
2. Um plug-in só importa ficheiros da sua pasta: não depende do núcleo nem de outros plug-ins. A única exceção é `import type` do contrato (`core/plugins/contracts.ts`), que o TypeScript apaga: em tempo de execução, o plug-in continua a não depender do núcleo.
3. Todos os plug-ins estão no registo e cumprem o contrato.
4. Dentro do núcleo, as regras do `modular/`: um módulo só usa outro pelo `index.ts` e só usa as suas tabelas.

No fim, mostra a **volatilidade** (commits no git que mexeram no núcleo e nos plug-ins). Num microkernel saudável, o núcleo muda pouco e os plug-ins mudam muito.

Para ver uma regra a falhar, acrescentar `import '../../store/porto-aliados/index.ts';` a `src/plugins/promotion/porto15/index.ts`.

## Testes

- `test/checkout.test.ts`: os 9 testes de sempre, sem alterações.
- `test/plugins.test.ts`:
  - cada plug-in testa-se **sozinho**, sem núcleo nem base de dados (`porto15.evaluate({ storeId: 'lisboa-campo-grande', … })`);
  - o núcleo **sem plug-ins** faz só o caminho feliz;
  - um plug-in novo passa a valer **sem mexer no núcleo**;
  - um plug-in que não cumpre o contrato é recusado no arranque.

## Perguntas para a aula

1. **Dados ou código?** Os códigos promocionais eram linhas numa tabela; agora são plug-ins. O que se ganhou (regras arbitrárias, testadas uma a uma) e o que se perdeu (o marketing já não cria um código sem um *deploy*)? Para que tipo de código faria sentido cada opção?
2. **Volatilidade:** se a Silicon Sandwiches abrir uma loja por semana, o que muda: o núcleo ou os plug-ins? E se mudar a forma de calcular o IVA?
3. **Dependências entre plug-ins:** o `PORTO15` sabe o id da loja do Porto. Devia ser parte do plug-in `store/porto-aliados`? O que acontece se a loja mudar de id?
4. **Tempo de execução:** como se passaria a carregar os plug-ins sem reiniciar (por exemplo, ler a lista de um ficheiro e usar `import()`)? O que fica mais difícil de testar?
5. **Quantum:** os plug-ins podiam ser serviços remotos (por exemplo, as regras de promoção num serviço do marketing). O sistema passava a ter mais do que um *quantum*? Porquê?
