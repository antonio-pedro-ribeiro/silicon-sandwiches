// Registo dos plug-ins ativos (plug-ins em tempo de compilação: entram com o build).
// Acrescentar um plug-in = criar a pasta plugins/<contrato>/<contexto>/ e juntar uma linha aqui.
// O núcleo não importa este ficheiro: é o app.ts que o entrega ao núcleo.
import type { Plugin } from '../core/plugins/contracts.ts';
import portoAliados from './store/porto-aliados/index.ts';
import lisboaCampoGrande from './store/lisboa-campo-grande/index.ts';
import fcul10 from './promotion/fcul10/index.ts';
import menos1 from './promotion/menos1/index.ts';
import porto15 from './promotion/porto15/index.ts';
import bemvindo from './promotion/bemvindo/index.ts';

export const plugins: Plugin[] = [portoAliados, lisboaCampoGrande, fcul10, menos1, porto15, bemvindo];
