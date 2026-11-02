// Router HTTP mínimo (sem frameworks): rotas com parâmetros, JSON e tradução de erros.
import type { IncomingMessage, ServerResponse } from 'node:http';

const STATUS_BY_ERROR: Record<string, number> = {
  BadRequestError: 400,
  PaymentDeclinedError: 402,
  NotFoundError: 404,
  ValidationError: 422,
  ServiceUnavailableError: 503,
};

// O corpo chega da rede: é `unknown` até alguém o validar.
export interface RouteRequest {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export interface RouteResponse {
  status?: number;
  body: unknown;
  contentType?: string;
}

export type RouteHandler = (req: RouteRequest) => RouteResponse | Promise<RouteResponse>;

interface Route {
  method: string;
  pattern: string;
  regex: RegExp;
  keys: string[];
  handler: RouteHandler;
}

export type Router = ReturnType<typeof createRouter>;

export function createRouter() {
  const routes: Route[] = [];

  function add(method: string, pattern: string, handler: RouteHandler): void {
    const keys: string[] = [];
    const regex = new RegExp(
      `^${pattern.replace(/:(\w+)/g, (_, key: string) => (keys.push(key), '([^/]+)'))}$`,
    );
    routes.push({ method, pattern, regex, keys, handler });
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = routes.find((r) => r.method === req.method && r.regex.test(url.pathname));
    if (!route) return send(res, 404, { error: `Rota não encontrada: ${req.method} ${url.pathname}` });

    const match = url.pathname.match(route.regex)!;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    try {
      const body = await readJson(req);
      const { status = 200, body: out, contentType } = await route.handler({ params, query: url.searchParams, body });
      send(res, status, out, contentType);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const status = STATUS_BY_ERROR[error.name] ?? 500;
      if (status === 500) console.error(err);
      send(res, status, { error: error.message });
    }
  }

  return {
    get: (pattern: string, handler: RouteHandler) => add('GET', pattern, handler),
    post: (pattern: string, handler: RouteHandler) => add('POST', pattern, handler),
    list: () => routes.map((r) => `${r.method} ${r.pattern}`),
    handle,
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET') return undefined;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('O corpo do pedido não é JSON válido'), { name: 'BadRequestError' });
  }
}

// Sem contentType, a resposta é JSON; com contentType (HTML, CSS, JS da interface), segue tal como está.
function send(res: ServerResponse, status: number, body: unknown, contentType?: string): void {
  if (contentType) {
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}
