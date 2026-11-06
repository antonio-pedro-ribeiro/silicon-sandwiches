// Erros de negócio. A camada de apresentação traduz cada um num código HTTP.
export class ValidationError extends Error {
  override name = 'ValidationError';
}

export class NotFoundError extends Error {
  override name = 'NotFoundError';
}

export class PaymentDeclinedError extends Error {
  override name = 'PaymentDeclinedError';
}

// Um serviço de que dependemos não respondeu (ou respondeu com um erro inesperado).
export class ServiceUnavailableError extends Error {
  override name = 'ServiceUnavailableError';
}
