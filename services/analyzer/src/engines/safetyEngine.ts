import { TelemetryEvent } from '../types/telemetry.js';

export type SafetyLabel = 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY';

export interface SafetyResult {
  safetyLabel: SafetyLabel;
  safetyScore: number;
  details?: string;
}

/**
 * Placeholder safety engine.
 * Phase 5 will implement real Vertex AI Safety classification.
 */
export async function checkSafety(event: TelemetryEvent): Promise<SafetyResult> {
  // Placeholder: Simple keyword check
  // Phase 5 will:
  // - Use Vertex AI Safety API or Gemini classifier
  // - Return proper safety labels and scores
  
  const promptLower = event.prompt.toLowerCase();
  const responseLower = event.response.toLowerCase();
  
  // Simple keyword detection (placeholder)
  if (promptLower.includes('ignore') || promptLower.includes('forget')) {
    return {
      safetyLabel: 'JAILBREAK',
      safetyScore: 0.3,
      details: 'Potential jailbreak attempt detected',
    };
  }
  
  if (responseLower.includes('password') || responseLower.includes('ssn')) {
    return {
      safetyLabel: 'PII',
      safetyScore: 0.4,
      details: 'Potential PII in response',
    };
  }
  
  return {
    safetyLabel: 'CLEAN',
    safetyScore: 1.0,
  };
}

