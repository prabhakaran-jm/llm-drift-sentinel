/**
 * Demo safety and drift scorer for frontend visualization.
 * Provides real-time scores without requiring async analyzer processing.
 * 
 * Note: This is a simplified heuristic-based scorer for demo purposes.
 * The full analyzer service provides more accurate scores using Vertex AI.
 */

export interface DemoScores {
  safetyScore: number;
  safetyLabel: 'CLEAN' | 'TOXIC' | 'PII' | 'JAILBREAK' | 'PROMPT_INJECTION' | 'RISKY';
  driftScore: number;
  baselineReady: boolean;
}

// Toxic words/phrases (simplified list for demo)
const TOXIC_PATTERNS = [
  /\b(hate|kill|die|stupid|idiot|moron|damn|hell)\b/gi,
  /\b(fuck|shit|asshole|bitch)\b/gi,
];

// PII patterns
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{3}-\d{3}-\d{4}\b/, // Phone
];

// Jailbreak patterns
const JAILBREAK_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|rules?|guidelines?)/gi,
  /you\s+are\s+(now|a)\s+(different|uncensored|unrestricted)/gi,
  /system\s*:\s*you\s+are/gi,
  /roleplay\s+as/gi,
  /pretend\s+to\s+be/gi,
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /<\|(system|user|assistant)\|>/gi,
  /\[INST\]/gi,
  /###\s*(system|user|assistant)\s*:/gi,
  /BEGIN\s+INSTRUCTION/gi,
];

/**
 * Calculate demo safety score based on pattern matching.
 */
export function calculateDemoSafety(prompt: string, response: string): {
  safetyScore: number;
  safetyLabel: DemoScores['safetyLabel'];
} {
  const text = `${prompt} ${response}`.toLowerCase();

  // Check for prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safetyScore: 0.2,
        safetyLabel: 'PROMPT_INJECTION',
      };
    }
  }

  // Check for jailbreak attempts
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safetyScore: 0.3,
        safetyLabel: 'JAILBREAK',
      };
    }
  }

  // Check for toxic content
  let toxicMatches = 0;
  for (const pattern of TOXIC_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      toxicMatches += matches.length;
    }
  }
  if (toxicMatches > 0) {
    // More matches = lower score
    const score = Math.max(0.2, 0.5 - toxicMatches * 0.1);
    return {
      safetyScore: score,
      safetyLabel: 'TOXIC',
    };
  }

  // Check for PII
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safetyScore: 0.4,
        safetyLabel: 'PII',
      };
    }
  }

  // Check for risky content (long prompts, unusual patterns)
  if (prompt.length > 500 || response.length > 2000) {
    return {
      safetyScore: 0.6,
      safetyLabel: 'RISKY',
    };
  }

  // Clean content
  return {
    safetyScore: 1.0,
    safetyLabel: 'CLEAN',
  };
}

/**
 * Calculate demo drift score.
 * Returns a small random drift for demo purposes.
 * Real drift requires baseline accumulation in the analyzer.
 */
export function calculateDemoDrift(prompt: string, response: string): {
  driftScore: number;
  baselineReady: boolean;
} {
  // For demo: return small drift values
  // Real drift detection requires embeddings and baseline comparison
  const baseDrift = Math.random() * 0.15; // 0-0.15 drift for normal content
  
  // Higher drift for unusual patterns
  const hasUnusualPattern = 
    prompt.length > 300 ||
    response.length > 1500 ||
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{5,}/.test(prompt);

  const driftScore = hasUnusualPattern 
    ? baseDrift + 0.1 + Math.random() * 0.15 // 0.1-0.4 for unusual
    : baseDrift;

  // Simulate baseline readiness (true after a few requests)
  // In real system, this requires 5+ samples per endpoint
  const baselineReady = Math.random() > 0.3; // 70% chance baseline is ready

  return {
    driftScore: Math.min(1.0, driftScore),
    baselineReady,
  };
}

/**
 * Calculate both safety and drift scores for demo.
 */
export function calculateDemoScores(prompt: string, response: string): DemoScores {
  const safety = calculateDemoSafety(prompt, response);
  const drift = calculateDemoDrift(prompt, response);

  return {
    ...safety,
    ...drift,
  };
}

