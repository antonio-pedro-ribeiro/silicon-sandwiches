// Rotas de Location.
import type { Router } from './http.ts';
import type { LocationService } from '../business/locationService.ts';

export function registerLocationRoutes(router: Router, locationService: LocationService): void {
  router.get('/stores', async () => ({ body: await locationService.listStores() }));
  router.post('/stores/:storeId/status', async ({ params, body }) => ({
    body: await locationService.setOpen(params.storeId, (body as { open?: unknown } | undefined)?.open),
  }));
}
