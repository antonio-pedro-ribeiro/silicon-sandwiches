// Interface web: uma só aplicação de front-end para todos os módulos (fala com eles pela API HTTP).
// São lidos a cada pedido, para que uma alteração apareça logo ao recarregar a página.
// O app.ts do browser é servido como JavaScript: o Node só lhe tira os tipos.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import type { Router } from '../shared/http.ts';

const FILES: Record<string, [file: string, contentType: string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/ui/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/ui/app.js': ['app.ts', 'text/javascript; charset=utf-8'],
};

function read(file: string): string {
  const content = readFileSync(new URL(`./public/${file}`, import.meta.url), 'utf8');
  return file.endsWith('.ts') ? stripTypeScriptTypes(content) : content;
}

export function registerWebRoutes(router: Router): void {
  for (const [path, [file, contentType]] of Object.entries(FILES)) {
    router.get(path, () => ({ contentType, body: read(file) }));
  }
}
