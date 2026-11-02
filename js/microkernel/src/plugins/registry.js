// Registo dos plug-ins ativos (plug-ins em tempo de compilação: entram com o build).
// Acrescentar um plug-in = criar a pasta plugins/<contrato>/<contexto>/ e juntar uma linha aqui.
// O núcleo não importa este ficheiro: é o app.js que o entrega ao núcleo.
import portoAliados from './store/porto-aliados/index.js';
import lisboaCampoGrande from './store/lisboa-campo-grande/index.js';
import fcul10 from './promotion/fcul10/index.js';
import menos1 from './promotion/menos1/index.js';
import porto15 from './promotion/porto15/index.js';
import bemvindo from './promotion/bemvindo/index.js';

export const plugins = [portoAliados, lisboaCampoGrande, fcul10, menos1, porto15, bemvindo];
