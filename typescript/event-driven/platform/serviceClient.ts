// Plataforma · cliente HTTP para um serviço chamar outro. Trata do que é igual em todas as chamadas:
// tempo limite, tradução dos erros (404/422 voltam a ser erros de negócio; o resto é 503) e o registo
// de cada chamada na consola ("checkout → inventory POST /api/reservations 201 · 4 ms"), que mostra
// o acoplamento dinâmico entre serviços. Fica em silêncio se SILENT estiver definido.
// O tipo da resposta (T) é o contrato com o outro serviço: quem chama diz o que espera receber.
import { NotFoundError, ServiceUnavailableError, ValidationError } from './errors.ts';

const ERROR_BY_STATUS: Record<number, new (message: string) => Error> = { 404: NotFoundError, 422: ValidationError };
const TIMEOUT_MS = 2000;

export type ServiceClient = ReturnType<typeof createServiceClient>;

export function createServiceClient({ from, to, baseUrl }: { from: string; to: string; baseUrl: string }) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const started = Date.now();
    let res: Response;
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
    if (res.ok) return data as T;
    const RemoteError = ERROR_BY_STATUS[res.status] ?? ServiceUnavailableError;
    throw new RemoteError(data?.error ?? `O serviço ${to} respondeu ${res.status}`);
  }

  return {
    name: to,
    url: baseUrl,
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
  };
}

function log(message: string): void {
  if (!process.env.SILENT) console.log(`  [http] ${message}`);
}
