type ClassPrimitive = string | number | boolean | null | undefined;
type ClassObject = Record<string, boolean | null | undefined>;
type ClassInput = ClassPrimitive | ClassObject;

/**
 * Merge className values into a single string.
 *
 * - Supports: string/number/boolean/null/undefined and object form `{ className: boolean }`
 * - Filters falsy values
 * - Does not depend on external libraries
 *
 * @example
 * cn('btn', 'primary') // "btn primary"
 *
 * @example
 * cn('btn', 2, false, null, undefined) // "btn 2"
 *
 * @example
 * cn('btn', { active: true, disabled: false }, { 'has-focus': true }) // "btn active has-focus"
 */
export function cn(...inputs: ReadonlyArray<ClassInput>): string {
  const out: string[] = [];

  for (const input of inputs) {
    if (input == null || input === false || input === true) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      const s = String(input).trim();
      if (s) out.push(s);
      continue;
    }

    if (isClassObject(input)) {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          const k = key.trim();
          if (k) out.push(k);
        }
      }
    }
  }

  return out.join(' ');
}

function isClassObject(value: ClassInput): value is ClassObject {
  return typeof value === 'object' && value !== null;
}