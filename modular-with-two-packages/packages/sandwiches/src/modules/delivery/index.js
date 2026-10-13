// Módulo Delivery · versão remota.
// O módulo verdadeiro corre noutro pacote de deployment (packages/delivery). Este index.js mantém a
// mesma API pública ({ quote, schedule }), por isso o CatalogCheckout não muda; mas cada chamada é
// agora um pedido HTTP, que pode demorar, falhar ou encontrar o serviço desligado.
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../../shared/errors.js';

const ERROR_BY_STATUS = { 404: NotFoundError, 422: ValidationError };
const TIMEOUT_MS = 2000;

export function createDeliveryModule({ baseUrl }) {
  async function call(method, path, body) {
    let res;
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
    if (res.ok) return data;
    // Os erros do outro processo voltam a ser erros de negócio deste lado.
    const RemoteError = ERROR_BY_STATUS[res.status] ?? ServiceUnavailableError;
    throw new RemoteError(data?.error ?? `O serviço Delivery respondeu ${res.status}`);
  }

  return {
    name: 'delivery',
    remote: baseUrl,
    // Só seguem pela rede os campos de que o Delivery precisa.
    api: {
      quote: ({ store, address }) => call('POST', '/api/quotes', { store: { id: store.id, name: store.name }, address }),
      schedule: ({ order, address }) =>
        call('POST', '/api/deliveries', { order: { id: order.id, storeId: order.storeId }, address }),
    },
    // A interface web continua a usar /deliveries nesta origem; o pedido é reencaminhado.
    registerRoutes: (router) => {
      router.get('/deliveries', async () => ({ body: await call('GET', '/deliveries') }));
      router.post('/deliveries/:id/advance', async ({ params }) => ({
        body: await call('POST', `/deliveries/${encodeURIComponent(params.id)}/advance`),
      }));
    },
  };
}
