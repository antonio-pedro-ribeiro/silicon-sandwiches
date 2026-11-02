// Biblioteca de entidades da partição common (as lojas). Usada por quase todos os serviços:
// uma alteração aqui obriga a testar e reimplantar todos os que a importam.
export { createStoreRepository } from './storeRepository.ts';
export type { Store, StoreRepository } from './storeRepository.ts';
