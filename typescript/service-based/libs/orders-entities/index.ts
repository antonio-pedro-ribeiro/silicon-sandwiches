// Biblioteca de entidades da partição orders: catálogo, menus locais, encomendas e códigos promocionais.
export { createCatalogRepository } from './catalogRepository.ts';
export { createOrderRepository } from './orderRepository.ts';
export { createPromotionRepository } from './promotionRepository.ts';
export type { CatalogRepository, Sandwich, StoreOverride } from './catalogRepository.ts';
export type { Fulfilment, NewOrder, Order, OrderLine, OrderRepository } from './orderRepository.ts';
export type { Promotion, PromotionRepository, Redemption } from './promotionRepository.ts';
