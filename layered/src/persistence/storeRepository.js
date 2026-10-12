// Lojas.
export function createStoreRepository(db) {
  const all = db.prepare('SELECT * FROM store ORDER BY name');
  const byId = db.prepare('SELECT * FROM store WHERE id = ?');
  const updateOpen = db.prepare('UPDATE store SET open = ? WHERE id = ?');

  const toStore = (r) => r && { id: r.id, name: r.name, city: r.city, address: r.address, open: r.open === 1 };

  return {
    findAll: () => all.all().map(toStore),
    findById: (id) => toStore(byId.get(id)),
    setOpen: (id, open) => updateOpen.run(open ? 1 : 0, id).changes === 1,
  };
}
