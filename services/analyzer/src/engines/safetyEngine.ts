import { TelemetryEvent } from '../types/telemetry.js';
import { SafetyClassifier } from '../services/safetyClassifier.js';

export type SafetyLabel = 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY';

export interface SafetyResult {
  safetyLabel: SafetyLabel;
  safetyScore: number;
  details?: string;
  isHighRisk: boolean;
}

const HIGH_RISK_LABELS: SafetyLabel[] = ['TOXIC', 'JAILBREAK', 'PROMPT_INJECTION'];
const RISK_THRESHOLD = 0.5; // Score below this is considered high risk

/**
 * Check safety using Vertex AI Safety classification.
 * Uses Gemini to classify prompts and responses for safety issues.
 */
export async function checkSafety(
  event: TelemetryEvent,
  safetyClassifier: SafetyClassifier
): Promise<SafetyResult> {
  // Skip safety check for error cases
  if (event.status === 'error' || !event.response || event.response.length === 0) {
    return {
      safetyLabel: 'CLEAN',
      safetyScore: 1.0,
      isHighRisk: false,
    };
  }

  try {
    const classification = await safetyClassifier.classifySafety(event.prompt, event.response);
    
    const isHighRisk = HIGH_RISK_LABELS.includes(classification.label) || 
                       classification.score < RISK_THRESHOLD;

    return {
      safetyLabel: classification.label,
      safetyScore: classification.score,
      details: classification.details,
      isHighRisk,
    };
  } catch (error: any) {
    console.error(`[SafetyEngine] Error checking safety for ${event.requestId}:`, error);
    // Return safe default on error
    return {
      safetyLabel: 'CLEAN',
      safetyScore: 1.0,
      isHighRisk: false,
      details: 'Safety check failed, defaulting to CLEAN',
    };
  }
}

