// Location: lojas e se estão abertas.
import { NotFoundError, ValidationError } from './errors.js';

export function createLocationService({ storeRepository }) {
  return {
    async getStore(id) {
      return storeRepository.findById(id);
    },
    async listStores() {
      return storeRepository.findAll();
    },
    async setOpen(id, open) {
      if (typeof open !== 'boolean') throw new ValidationError('open tem de ser true ou false');
      if (!storeRepository.setOpen(id, open)) throw new NotFoundError(`Loja desconhecida: ${id}`);
      return storeRepository.findById(id);
    },
  };
}
