import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../cosineSimilarity.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = [1, 2, 3];
    const result = cosineSimilarity(vec, vec);
    expect(result).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const vecA = [1, 0];
    const vecB = [0, 1];
    const result = cosineSimilarity(vecA, vecB);
    expect(result).toBeCloseTo(0, 5);
  });

  it('handles zero vectors', () => {
    const vecA = [0, 0, 0];
    const vecB = [1, 2, 3];
    const result = cosineSimilarity(vecA, vecB);
    expect(result).toBe(0);
  });

  it('calculates similarity correctly for positive vectors', () => {
    const vecA = [1, 1, 0];
    const vecB = [1, 0, 0];
    const result = cosineSimilarity(vecA, vecB);
    // cos(45°) = √2/2 ≈ 0.707
    expect(result).toBeCloseTo(Math.sqrt(2) / 2, 3);
  });

  it('handles negative values correctly', () => {
    const vecA = [1, -1, 0];
    const vecB = [1, 1, 0];
    const result = cosineSimilarity(vecA, vecB);
    // Should be 0 (orthogonal)
    expect(result).toBeCloseTo(0, 5);
  });

  it('throws error for vectors of different lengths', () => {
    const vecA = [1, 2, 3];
    const vecB = [1, 2];
    expect(() => cosineSimilarity(vecA, vecB)).toThrow('Vectors must have the same length');
  });

  it('handles high-dimensional vectors', () => {
    const vecA = new Array(768).fill(1);
    const vecB = new Array(768).fill(1);
    const result = cosineSimilarity(vecA, vecB);
    expect(result).toBeCloseTo(1, 5);
  });

  it('returns correct similarity for embedding-like vectors', () => {
    // Simulate typical embedding values (small positive numbers)
    const vecA = [0.1, 0.2, 0.3, 0.4];
    const vecB = [0.15, 0.25, 0.35, 0.45];
    const result = cosineSimilarity(vecA, vecB);
    // Should be close to 1 (very similar)
    expect(result).toBeGreaterThan(0.99);
  });
});

