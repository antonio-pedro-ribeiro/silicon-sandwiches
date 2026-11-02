// Router HTTP mínimo (sem frameworks): rotas com parâmetros, JSON e tradução de erros.
const STATUS_BY_ERROR = {
  BadRequestError: 400,
  PaymentDeclinedError: 402,
  NotFoundError: 404,
  ValidationError: 422,
  ServiceUnavailableError: 503,
};

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      `^${pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)'))}$`,
    );
    routes.push({ method, pattern, regex, keys, handler });
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = routes.find((r) => r.method === req.method && r.regex.test(url.pathname));
    if (!route) return send(res, 404, { error: `Rota não encontrada: ${req.method} ${url.pathname}` });

    const match = url.pathname.match(route.regex);
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    try {
      const body = await readJson(req);
      const { status = 200, body: out, contentType } = await route.handler({ params, query: url.searchParams, body });
      send(res, status, out, contentType);
    } catch (err) {
      const status = STATUS_BY_ERROR[err.name] ?? 500;
      if (status === 500) console.error(err);
      send(res, status, { error: err.message });
    }
  }

  return {
    get: (pattern, handler) => add('GET', pattern, handler),
    post: (pattern, handler) => add('POST', pattern, handler),
    list: () => routes.map((r) => `${r.method} ${r.pattern}`),
    handle,
  };
}

async function readJson(req) {
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
function send(res, status, body, contentType) {
  if (contentType) {
    res.writeHead(status, { 'Content-Type': contentType });
    return res.end(body);
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}
