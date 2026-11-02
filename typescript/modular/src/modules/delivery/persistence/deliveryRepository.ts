// Zonas de entrega (taxa e tempo por loja) e entregas.
import { rowsOf, type Database } from '../../../shared/db.ts';

export type DeliveryStatus = 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export interface DeliveryZone {
  feeCents: number;
  etaMinutes: number;
}

export interface NewDeliveryJob {
  orderId: number;
  storeId: string;
  address: string;
  etaMinutes: number;
}

export interface DeliveryJob extends NewDeliveryJob {
  id: number;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
}

interface JobRow {
  id: number;
  order_id: number;
  store_id: string;
  address: string;
  status: DeliveryStatus;
  eta_minutes: number;
  created_at: string;
  updated_at: string;
}

export type DeliveryRepository = ReturnType<typeof createDeliveryRepository>;

export function createDeliveryRepository(db: Database) {
  const zoneByStore = db.prepare('SELECT fee_cents, eta_minutes FROM delivery_zone WHERE store_id = ?');
  const insertJob = db.prepare(
    "INSERT INTO delivery_job (order_id, store_id, address, status, eta_minutes) VALUES (?, ?, ?, 'SCHEDULED', ?)",
  );
  const all = db.prepare('SELECT * FROM delivery_job ORDER BY id DESC');
  const byId = db.prepare('SELECT * FROM delivery_job WHERE id = ?');
  const updateStatus = db.prepare("UPDATE delivery_job SET status = ?, updated_at = datetime('now') WHERE id = ?");

  const toJob = (r: JobRow): DeliveryJob => ({
    id: r.id,
    orderId: r.order_id,
    storeId: r.store_id,
    address: r.address,
    status: r.status,
    etaMinutes: r.eta_minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  const findById = (id: number): DeliveryJob | undefined => {
    const row = byId.get(id) as JobRow | undefined;
    return row && toJob(row);
  };

  return {
    findZone: (storeId: string): DeliveryZone | undefined => {
      const z = zoneByStore.get(storeId) as { fee_cents: number; eta_minutes: number } | undefined;
      return z && { feeCents: z.fee_cents, etaMinutes: z.eta_minutes };
    },
    create: ({ orderId, storeId, address, etaMinutes }: NewDeliveryJob): DeliveryJob =>
      findById(Number(insertJob.run(orderId, storeId, address, etaMinutes).lastInsertRowid))!,
    findAll: (): DeliveryJob[] => rowsOf<JobRow>(all.all()).map(toJob),
    findById,
    setStatus: (id: number, status: DeliveryStatus) => updateStatus.run(status, id),
  };
}
