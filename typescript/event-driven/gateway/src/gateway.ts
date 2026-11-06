// API gateway: o único ponto de entrada dos clientes. Encaminha cada rota pública para o microsserviço
// que a trata e não faz mais nada de negócio: não orquestra, não junta respostas, não conhece regras.
// Além do encaminhamento, só preocupações transversais: escolher a instância (round-robin, saltando as
// que não respondem) e agregar o /health. As rotas internas (/api/…, /events/…) não são expostas.
import { ServiceUnavailableError } from '../../platform/errors.ts';
import type { RouteResponse, Router } from '../../platform/http.ts';

type Method = 'GET' | 'POST';

// [método, rota, serviço] · a mesma API de sempre, agora repartida por sete serviços.
export const ROUTES: [method: Method, pattern: string, service: string][] = [
  ['GET', '/stores/:storeId/menu', 'checkout'],
  ['POST', '/checkout', 'checkout'],
  ['GET', '/orders/:id', 'checkout'],
  ['GET', '/stores', 'location'],
  ['POST', '/stores/:storeId/status', 'location'],
  ['GET', '/promotions', 'promotion'],
  ['GET', '/inventory/:storeId', 'inventory'],
  ['POST', '/inventory/:storeId/restock', 'inventory'],
  ['GET', '/recipes/:sandwichId', 'recipes'],
  ['GET', '/kitchen/queue', 'kitchen'],
  ['POST', '/kitchen/tickets/:id/advance', 'kitchen'],
  ['GET', '/deliveries', 'delivery'],
  ['POST', '/deliveries/:id/advance', 'delivery'],
];

const TIMEOUT_MS = 2000;

// services: { checkout: ['http://localhost:3201'], location: [...], ... }
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
