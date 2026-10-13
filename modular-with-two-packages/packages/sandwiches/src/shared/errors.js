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

// Um serviço de que dependemos (outro pacote de deployment) não respondeu.
export class ServiceUnavailableError extends Error {
  name = 'ServiceUnavailableError';
}
