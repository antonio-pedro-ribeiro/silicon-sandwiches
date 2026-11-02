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
