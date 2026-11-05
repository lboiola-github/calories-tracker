/** Id de operación para idempotencia: se genera una vez por intento del usuario y se reusa en reintentos. */
export function newOperationId(): string {
  return crypto.randomUUID();
}
