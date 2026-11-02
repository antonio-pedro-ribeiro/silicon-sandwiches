// Plataforma · cliente HTTP para um serviço chamar outro. Trata do que é igual em todas as chamadas:
// tempo limite, tradução dos erros (404/422 voltam a ser erros de negócio; o resto é 503) e o registo
// de cada chamada na consola ("checkout → inventory POST /api/reservations 201 · 4 ms"), que mostra
// o acoplamento dinâmico entre serviços. Fica em silêncio se SILENT estiver definido.
import { NotFoundError, ServiceUnavailableError, ValidationError } from './errors.js';

const ERROR_BY_STATUS = { 404: NotFoundError, 422: ValidationError };
const TIMEOUT_MS = 2000;

export function createServiceClient({ from, to, baseUrl }) {
  async function call(method, path, body) {
    const started = Date.now();
    let res;
    try {
      res = await fetch(new URL(path, baseUrl), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      log(`${from} → ${to} ${method} ${path} ✘ sem resposta`);
      throw new ServiceUnavailableError(`O serviço ${to} não responde`);
    }
    log(`${from} → ${to} ${method} ${path} ${res.status} · ${Date.now() - started} ms`);
    const data = await res.json().catch(() => null);
    if (res.ok) return data;
    const RemoteError = ERROR_BY_STATUS[res.status] ?? ServiceUnavailableError;
    throw new RemoteError(data?.error ?? `O serviço ${to} respondeu ${res.status}`);
  }

  return {
    name: to,
    url: baseUrl,
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
  };
}

function log(message) {
  if (!process.env.SILENT) console.log(`  [http] ${message}`);
}
