// API gateway da interface: encaminha cada rota pública para o serviço de domínio que a trata.
// Não tem lógica de negócio. Faz só o encaminhamento, o balanceamento de carga (round-robin entre
// as instâncias de um serviço, saltando as que não respondem) e a agregação do /health.
import { ServiceUnavailableError } from '../../libs/platform/errors.ts';
import type { RouteResponse, Router } from '../../libs/platform/http.ts';

type Method = 'GET' | 'POST';

// [método, rota, serviço] · a mesma API de sempre, agora repartida por quatro serviços.
export const ROUTES: [method: Method, pattern: string, service: string][] = [
  ['GET', '/stores/:storeId/menu', 'orders'],
  ['POST', '/checkout', 'orders'],
  ['GET', '/orders/:id', 'orders'],
  ['GET', '/promotions', 'orders'],
  ['GET', '/stores', 'stores'],
  ['POST', '/stores/:storeId/status', 'stores'],
  ['GET', '/inventory/:storeId', 'stores'],
  ['POST', '/inventory/:storeId/restock', 'stores'],
  ['GET', '/recipes/:sandwichId', 'stores'],
  ['GET', '/kitchen/queue', 'kitchen'],
  ['POST', '/kitchen/tickets/:id/advance', 'kitchen'],
  ['GET', '/deliveries', 'delivery'],
  ['POST', '/deliveries/:id/advance', 'delivery'],
];

const TIMEOUT_MS = 2000;

// services: { orders: ['http://localhost:3101', 'http://localhost:3111'], stores: [...], ... }
export type ServiceUrls = Record<string, string[]>;

export function createGateway(services: ServiceUrls) {
  const turn: Record<string, number> = Object.fromEntries(Object.keys(services).map((name) => [name, 0]));

  async function forward(service: string, method: Method, path: string, body: unknown): Promise<RouteResponse> {
    const urls = services[service];
    for (let attempt = 0; attempt < urls.length; attempt++) {
      const url = urls[turn[service]++ % urls.length];
      try {
        const res = await fetch(new URL(path, url), {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return { status: res.status, body: await res.json().catch(() => ({ error: `${service} respondeu ${res.status}` })) };
      } catch (err) {
        // Esgotou o tempo: o pedido pode ter sido feito, por isso não se repete noutra instância.
        if ((err as Error).name === 'TimeoutError') break;
        // Ligação recusada: esta instância está em baixo; tenta-se a seguinte.
      }
    }
    throw new ServiceUnavailableError(`O serviço ${service} não responde`);
  }

  async function isUp(url: string): Promise<boolean> {
    try {
      return (await fetch(new URL('/health', url), { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  }

  return {
    register(router: Router): void {
      for (const [method, pattern, service] of ROUTES) {
        const add = method === 'GET' ? router.get : router.post;
        add(pattern, ({ params, query, body }) => {
          const path = pattern.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key]));
          return forward(service, method, query.size ? `${path}?${query}` : path, body);
        });
      }
    },
    // Estado de cada instância de cada serviço, para a interface.
    async health(): Promise<Record<string, { url: string; up: boolean }[]>> {
      const entries = await Promise.all(Object.entries(services).map(async ([name, urls]) =>
        [name, await Promise.all(urls.map(async (url) => ({ url, up: await isUp(url) })))]));
      return Object.fromEntries(entries);
    },
  };
}
