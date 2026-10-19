// Zonas de entrega (taxa e tempo por loja) e entregas.
export function createDeliveryRepository(db) {
  const zoneByStore = db.prepare('SELECT fee_cents, eta_minutes FROM delivery_zone WHERE store_id = ?');
  const insertJob = db.prepare(
    "INSERT INTO delivery_job (order_id, store_id, address, status, eta_minutes) VALUES (?, ?, ?, 'SCHEDULED', ?)",
  );
  const all = db.prepare('SELECT * FROM delivery_job ORDER BY id DESC');
  const byId = db.prepare('SELECT * FROM delivery_job WHERE id = ?');
  const updateStatus = db.prepare("UPDATE delivery_job SET status = ?, updated_at = datetime('now') WHERE id = ?");

  const toJob = (r) => r && {
    id: r.id,
    orderId: r.order_id,
    storeId: r.store_id,
    address: r.address,
    status: r.status,
    etaMinutes: r.eta_minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

  return {
    findZone: (storeId) => {
      const z = zoneByStore.get(storeId);
      return z && { feeCents: z.fee_cents, etaMinutes: z.eta_minutes };
    },
    create: ({ orderId, storeId, address, etaMinutes }) =>
      toJob(byId.get(Number(insertJob.run(orderId, storeId, address, etaMinutes).lastInsertRowid))),
    findAll: () => all.all().map(toJob),
    findById: (id) => toJob(byId.get(id)),
    setStatus: (id, status) => updateStatus.run(status, id),
  };
}
