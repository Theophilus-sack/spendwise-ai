export class ValidationError extends Error {}

/** Requires a non-empty string under maxLength, or throws ValidationError. */
export function requireString(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long (max ${maxLength} characters).`);
  }
  return value;
}

/** Same as requireString but allows undefined/empty — used for optional fields. */
export function optionalString(value: unknown, maxLength: number, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, maxLength, fieldName);
}
