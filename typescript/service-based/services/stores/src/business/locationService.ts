// Location: lojas e se estão abertas.
import { NotFoundError, ValidationError } from '../../../../libs/platform/errors.ts';
import type { Store, StoreRepository } from '../../../../libs/common-entities/index.ts';

export type LocationService = ReturnType<typeof createLocationService>;

export function createLocationService({ storeRepository }: { storeRepository: StoreRepository }) {
  return {
    async getStore(id: string): Promise<Store | undefined> {
      return storeRepository.findById(id);
    },
    async listStores(): Promise<Store[]> {
      return storeRepository.findAll();
    },
    async setOpen(id: string, open: unknown): Promise<Store> {
      if (typeof open !== 'boolean') throw new ValidationError('open tem de ser true ou false');
      if (!storeRepository.setOpen(id, open)) throw new NotFoundError(`Loja desconhecida: ${id}`);
      return storeRepository.findById(id)!;
    },
  };
}
