// Módulo Delivery · versão remota.
// O módulo verdadeiro corre noutro pacote de deployment (packages/delivery). Este index.ts mantém a
// mesma API pública ({ quote, schedule }), por isso o CatalogCheckout não muda; mas cada chamada é
// agora um pedido HTTP, que pode demorar, falhar ou encontrar o serviço desligado.
// Os tipos abaixo são o contrato HTTP: não se importa nada do outro pacote.
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../../shared/errors.ts';
import type { Router } from '../../shared/http.ts';

export type DeliveryQuote =
  | { available: true; feeCents: number; etaMinutes: number }
  | { available: false; reason: string };

export interface DeliveryJob {
  id: number;
  orderId: number;
  storeId: string;
  address: string;
  status: string;
  etaMinutes: number;
}

const ERROR_BY_STATUS: Record<number, new (message: string) => Error> = { 404: NotFoundError, 422: ValidationError };
const TIMEOUT_MS = 2000;

export type DeliveryApi = ReturnType<typeof createDeliveryModule>['api'];

export function createDeliveryModule({ baseUrl }: { baseUrl: string }) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(new URL(path, baseUrl), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableError(`O serviço Delivery não responde em ${baseUrl}`);
    }
    const data = await res.json().catch(() => null);
    if (res.ok) return data as T;
    // Os erros do outro processo voltam a ser erros de negócio deste lado.
    const RemoteError = ERROR_BY_STATUS[res.status] ?? ServiceUnavailableError;
    throw new RemoteError(data?.error ?? `O serviço Delivery respondeu ${res.status}`);
  }

  return {
    name: 'delivery',
    remote: baseUrl,
    // Só seguem pela rede os campos de que o Delivery precisa.
    api: {
      quote: ({ store, address }: { store: { id: string; name: string }; address?: string }) =>
        call<DeliveryQuote>('POST', '/api/quotes', { store: { id: store.id, name: store.name }, address }),
      schedule: ({ order, address }: { order: { id: number; storeId: string }; address: string }) =>
        call<DeliveryJob>('POST', '/api/deliveries', { order: { id: order.id, storeId: order.storeId }, address }),
    },
    // A interface web continua a usar /deliveries nesta origem; o pedido é reencaminhado.
    registerRoutes: (router: Router) => {
      router.get('/deliveries', async () => ({ body: await call<DeliveryJob[]>('GET', '/deliveries') }));
      router.post('/deliveries/:id/advance', async ({ params }) => ({
        body: await call<DeliveryJob>('POST', `/deliveries/${encodeURIComponent(params.id)}/advance`),
      }));
    },
  };
}
