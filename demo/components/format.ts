export function formatValue(value: unknown): string {
  return value === undefined ? 'no result' : JSON.stringify(value, null, 2);
}

// HttpError carries the response body, which says more than its message.
export function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const body = 'body' in error ? (error as { body: unknown }).body : undefined;
  return body === undefined || body === ''
    ? error.message
    : `${error.message}\n${JSON.stringify(body, null, 2)}`;
}
