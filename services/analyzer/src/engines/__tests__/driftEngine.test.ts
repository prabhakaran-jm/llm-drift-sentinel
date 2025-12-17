import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeDrift } from '../driftEngine.js';
import { TelemetryEvent } from '../../types/telemetry.js';
import { EmbeddingsClient } from '../../services/embeddingsClient.js';
import { BaselineStore } from '../../services/baselineStore.js';

describe('computeDrift', () => {
  let mockEmbeddingsClient: any;
  let mockBaselineStore: any;
  let testEvent: TelemetryEvent;

  beforeEach(() => {
    // Mock embeddings client
    mockEmbeddingsClient = {
      getEmbedding: vi.fn(),
    };

    // Mock baseline store
    mockBaselineStore = {
      getBaseline: vi.fn(),
      isBaselineReady: vi.fn(),
      updateBaseline: vi.fn(),
    };

    // Create test event
    testEvent = {
      requestId: 'test-123',
      timestamp: new Date().toISOString(),
      endpoint: '/api/chat',
      method: 'POST',
      prompt: 'Test prompt',
      promptLength: 11,
      response: 'Test response',
      responseLength: 13,
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

  it('returns zero drift for first request (no baseline)', async () => {
    mockBaselineStore.getBaseline.mockReturnValue(null);
    mockBaselineStore.isBaselineReady.mockReturnValue(false);
    mockEmbeddingsClient.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await computeDrift(testEvent, mockEmbeddingsClient, mockBaselineStore);

    expect(result.driftScore).toBe(0);
    expect(result.similarityScore).toBe(1.0);
    expect(result.baselineReady).toBe(false);
    expect(mockBaselineStore.updateBaseline).toHaveBeenCalled();
  });

  it('skips drift computation for error status', async () => {
    const errorEvent = { ...testEvent, status: 'error' as const };

    const result = await computeDrift(errorEvent, mockEmbeddingsClient, mockBaselineStore);

    expect(result.driftScore).toBe(0);
    expect(result.similarityScore).toBe(1.0);
    expect(mockEmbeddingsClient.getEmbedding).not.toHaveBeenCalled();
  });

  it('skips drift computation for empty response', async () => {
    const emptyEvent = { ...testEvent, response: '' };

    const result = await computeDrift(emptyEvent, mockEmbeddingsClient, mockBaselineStore);

    expect(result.driftScore).toBe(0);
    expect(mockEmbeddingsClient.getEmbedding).not.toHaveBeenCalled();
  });

  it('calculates drift correctly for similar responses', async () => {
    const baselineEmbedding = [0.1, 0.2, 0.3, 0.4];
    const responseEmbedding = [0.11, 0.21, 0.31, 0.41]; // Very similar

    mockBaselineStore.getBaseline.mockReturnValue({
      endpoint: '/api/chat',
      embedding: baselineEmbedding,
      sampleCount: 10,
      lastUpdated: new Date(),
    });
    mockBaselineStore.isBaselineReady.mockReturnValue(true);
    mockEmbeddingsClient.getEmbedding.mockResolvedValue(responseEmbedding);

    const result = await computeDrift(testEvent, mockEmbeddingsClient, mockBaselineStore);

    // Similar embeddings should have low drift
    expect(result.driftScore).toBeLessThan(0.1);
    expect(result.similarityScore).toBeGreaterThan(0.9);
    expect(result.baselineReady).toBe(true);
  });

  it('calculates drift correctly for different responses', async () => {
    const baselineEmbedding = [1, 0, 0, 0];
    const responseEmbedding = [0, 1, 0, 0]; // Orthogonal (very different)

    mockBaselineStore.getBaseline.mockReturnValue({
      endpoint: '/api/chat',
      embedding: baselineEmbedding,
      sampleCount: 10,
      lastUpdated: new Date(),
    });
    mockBaselineStore.isBaselineReady.mockReturnValue(true);
    mockEmbeddingsClient.getEmbedding.mockResolvedValue(responseEmbedding);

    const result = await computeDrift(testEvent, mockEmbeddingsClient, mockBaselineStore);

    // Orthogonal embeddings should have high drift
    expect(result.driftScore).toBeGreaterThan(0.9);
    expect(result.similarityScore).toBeLessThan(0.1);
  });

  it('handles errors gracefully', async () => {
    mockBaselineStore.getBaseline.mockReturnValue({
      endpoint: '/api/chat',
      embedding: [0.1, 0.2, 0.3],
      sampleCount: 10,
      lastUpdated: new Date(),
    });
    mockEmbeddingsClient.getEmbedding.mockRejectedValue(new Error('API error'));

    const result = await computeDrift(testEvent, mockEmbeddingsClient, mockBaselineStore);

    expect(result.driftScore).toBe(0);
    expect(result.similarityScore).toBe(1.0);
    expect(result.baselineId).toContain('error');
  });

  it('clamps similarity to [0, 1] range', async () => {
    const baselineEmbedding = [0.1, 0.2, 0.3];
    const responseEmbedding = [0.1, 0.2, 0.3]; // Identical

    mockBaselineStore.getBaseline.mockReturnValue({
      endpoint: '/api/chat',
      embedding: baselineEmbedding,
      sampleCount: 10,
      lastUpdated: new Date(),
    });
    mockBaselineStore.isBaselineReady.mockReturnValue(true);
    mockEmbeddingsClient.getEmbedding.mockResolvedValue(responseEmbedding);

    const result = await computeDrift(testEvent, mockEmbeddingsClient, mockBaselineStore);

    expect(result.similarityScore).toBeGreaterThanOrEqual(0);
    expect(result.similarityScore).toBeLessThanOrEqual(1);
    expect(result.driftScore).toBeGreaterThanOrEqual(0);
    expect(result.driftScore).toBeLessThanOrEqual(1);
  });
});

