// API do serviço Location. /stores… é pública (o gateway encaminha-a); /api/… é só para outros serviços.
import type { Router } from '../../../../platform/http.ts';
import type { LocationService } from '../business/locationService.ts';

export function registerLocationApi(router: Router, locationService: LocationService): void {
  router.get('/stores', async () => ({ body: await locationService.listStores() }));
  router.post('/stores/:storeId/status', async ({ params, body }) => ({
    body: await locationService.setOpen(params.storeId, (body as { open?: unknown } | undefined)?.open),
  }));

  router.get('/api/stores/:storeId', async ({ params }) => {
    const store = await locationService.getStore(params.storeId);
    return store ? { body: store } : { status: 404, body: { error: `Loja desconhecida: ${params.storeId}` } };
  });
}
