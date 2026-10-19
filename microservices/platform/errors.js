// Erros de negócio. A camada de apresentação traduz cada um num código HTTP.
export class ValidationError extends Error {
  name = 'ValidationError';
}

export class NotFoundError extends Error {
  name = 'NotFoundError';
}

export class PaymentDeclinedError extends Error {
  name = 'PaymentDeclinedError';
}

// Um serviço de que dependemos não respondeu (ou respondeu com um erro inesperado).
export class ServiceUnavailableError extends Error {
  name = 'ServiceUnavailableError';
}
