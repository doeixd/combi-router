// =================================================================
//
//      Combi-Router: Validation Helper
//
//      This module contains validation utilities for Standard Schema.
//
// =================================================================

import type { StandardSchemaV1 } from '@standard-schema/spec';

// =================================================================
// ---------------- VALIDATION HELPER -----------------------------
// =================================================================

/**
 * Synchronously validates input against a Standard Schema.
 * Throws if validation is asynchronous.
 * @internal
 */
export function validateWithStandardSchemaSync<S extends StandardSchemaV1>(
  schema: S,
  input: unknown
): StandardSchemaV1.Result<StandardSchemaV1.InferOutput<S>> {
  const validationOutcome = schema['~standard'].validate(input);

  if (validationOutcome instanceof Promise) {
    // This router's param/query validation path is synchronous.
    // Async validation for these would require significant refactoring.
    return {
      issues: [{ message: "Schema validation must be synchronous for URL parameters." }]
    } as StandardSchemaV1.FailureResult;
  }
  // Type assertion is okay here because we've checked for Promise.
  return validationOutcome as StandardSchemaV1.Result<StandardSchemaV1.InferOutput<S>>;
}
