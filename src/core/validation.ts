// =================================================================
//
//      Combi-Router: Enhanced Validation Helper
//
//      This module contains validation utilities for Standard Schema
//      with improved error reporting and type safety.
//
// =================================================================

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InferSchemaType } from './types';

// =================================================================
// --------------- ENHANCED VALIDATION HELPERS -------------------
// =================================================================

/**
 * Enhanced validation result with better error context
 */
export interface ValidationResult<T> {
  success: boolean;
  value?: T;
  error?: string;
  issues?: readonly StandardSchemaV1.Issue[];
}

/**
 * Synchronously validates input against a Standard Schema with enhanced error reporting.
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

/**
 * Enhanced validation function with better error messages and type safety.
 * Returns a structured result instead of throwing.
 */
export function validateSafely<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
  context?: string
): ValidationResult<InferSchemaType<S>> {
  try {
    const result = validateWithStandardSchemaSync(schema, input);
    
    if (result.issues) {
      const errorMessage = context 
        ? `${context}: ${result.issues.map(i => i.message).join(', ')}`
        : result.issues.map(i => i.message).join(', ');
      
      return {
        success: false,
        error: errorMessage,
        issues: result.issues
      };
    }
    
    return {
      success: true,
      value: result.value as InferSchemaType<S>
    };
  } catch (error) {
    const errorMessage = context 
      ? `${context}: Validation error - ${error instanceof Error ? error.message : 'Unknown error'}`
      : `Validation error - ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
