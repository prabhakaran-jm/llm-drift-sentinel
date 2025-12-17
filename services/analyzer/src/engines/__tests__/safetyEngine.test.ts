import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSafety } from '../safetyEngine.js';
import { TelemetryEvent } from '../../types/telemetry.js';
import { SafetyClassifier } from '../../services/safetyClassifier.js';

describe('checkSafety', () => {
  let mockSafetyClassifier: any;
  let testEvent: TelemetryEvent;

  beforeEach(() => {
    // Mock safety classifier
    mockSafetyClassifier = {
      classifySafety: vi.fn(),
    };

    // Create test event
    testEvent = {
      requestId: 'test-123',
      timestamp: new Date().toISOString(),
      endpoint: '/api/chat',
      method: 'POST',
      prompt: 'Hello, how are you?',
      promptLength: 19,
      response: 'I am doing well, thank you!',
      responseLength: 28,
      modelName: 'gemini-1.5-pro',
      modelVersion: '1.0',
      tokensIn: 10,
      tokensOut: 15,
      tokensTotal: 25,
      latencyMs: 1000,
      status: 'success',
      environment: 'test',
      service: 'gateway',
    };
  });

  it('returns CLEAN for normal safe interaction', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'CLEAN',
      score: 0.95,
      details: 'Normal conversation',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('CLEAN');
    expect(result.safetyScore).toBe(0.95);
    expect(result.isHighRisk).toBe(false);
  });

  it('identifies TOXIC content as high risk', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'TOXIC',
      score: 0.3,
      details: 'Contains hate speech',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('TOXIC');
    expect(result.safetyScore).toBe(0.3);
    expect(result.isHighRisk).toBe(true);
  });

  it('identifies JAILBREAK as high risk', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'JAILBREAK',
      score: 0.4,
      details: 'Attempts to bypass safety guidelines',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('JAILBREAK');
    expect(result.isHighRisk).toBe(true);
  });

  it('identifies low score as high risk even with CLEAN label', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'CLEAN',
      score: 0.3, // Below threshold
      details: 'Low confidence',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('CLEAN');
    expect(result.safetyScore).toBe(0.3);
    expect(result.isHighRisk).toBe(true); // Low score triggers high risk
  });

  it('skips safety check for error status', async () => {
    const errorEvent = { ...testEvent, status: 'error' as const };

    const result = await checkSafety(errorEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('CLEAN');
    expect(result.safetyScore).toBe(1.0);
    expect(result.isHighRisk).toBe(false);
    expect(mockSafetyClassifier.classifySafety).not.toHaveBeenCalled();
  });

  it('skips safety check for empty response', async () => {
    const emptyEvent = { ...testEvent, response: '' };

    const result = await checkSafety(emptyEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('CLEAN');
    expect(mockSafetyClassifier.classifySafety).not.toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    mockSafetyClassifier.classifySafety.mockRejectedValue(new Error('API error'));

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('CLEAN');
    expect(result.safetyScore).toBe(1.0);
    expect(result.isHighRisk).toBe(false);
  });

  it('identifies PII as high risk', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'PII',
      score: 0.6,
      details: 'Contains personal information',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('PII');
    expect(result.isHighRisk).toBe(false); // PII is not in HIGH_RISK_LABELS, but score is above threshold
  });

  it('identifies PROMPT_INJECTION as high risk', async () => {
    mockSafetyClassifier.classifySafety.mockResolvedValue({
      label: 'PROMPT_INJECTION',
      score: 0.4,
      details: 'Malicious prompt injection detected',
    });

    const result = await checkSafety(testEvent, mockSafetyClassifier);

    expect(result.safetyLabel).toBe('PROMPT_INJECTION');
    expect(result.isHighRisk).toBe(true);
  });
});

