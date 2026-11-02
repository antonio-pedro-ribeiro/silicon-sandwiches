// Lojas.
import { rowsOf, type Database } from '../../../shared/db.ts';

export interface Store {
  id: string;
  name: string;
  city: string;
  address: string;
  open: boolean;
}

interface StoreRow { id: string; name: string; city: string; address: string; open: number }

export type StoreRepository = ReturnType<typeof createStoreRepository>;

export function createStoreRepository(db: Database) {
  const all = db.prepare('SELECT * FROM location_store ORDER BY name');
  const byId = db.prepare('SELECT * FROM location_store WHERE id = ?');
  const updateOpen = db.prepare('UPDATE location_store SET open = ? WHERE id = ?');

  const toStore = (r: StoreRow): Store => ({ id: r.id, name: r.name, city: r.city, address: r.address, open: r.open === 1 });

  return {
    findAll: (): Store[] => rowsOf<StoreRow>(all.all()).map(toStore),
    findById: (id: string): Store | undefined => {
      const row = byId.get(id) as StoreRow | undefined;
      return row && toStore(row);
    },
    setOpen: (id: string, open: boolean): boolean => updateOpen.run(open ? 1 : 0, id).changes === 1,
  };
}
