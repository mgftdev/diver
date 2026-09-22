export class AppError extends Error {
  constructor(message, { status = 500, code = 'internal_error', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new AppError(message, { status: 400, code: 'bad_request', details });

export const unauthorized = (message = 'Missing or invalid admin token.') =>
  new AppError(message, { status: 401, code: 'unauthorized' });

export const notFound = (message = 'Not found.') =>
  new AppError(message, { status: 404, code: 'not_found' });
