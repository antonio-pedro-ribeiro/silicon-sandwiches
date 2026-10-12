// Interface web: uma só aplicação de front-end para todos os módulos (fala com eles pela API HTTP).
// São lidos a cada pedido, para que uma alteração apareça logo ao recarregar a página.
import { readFileSync } from 'node:fs';

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/ui/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/ui/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

export function registerWebRoutes(router) {
  for (const [path, [file, contentType]] of Object.entries(FILES)) {
    router.get(path, () => ({ contentType, body: readFileSync(new URL(`./public/${file}`, import.meta.url)) }));
  }
}
