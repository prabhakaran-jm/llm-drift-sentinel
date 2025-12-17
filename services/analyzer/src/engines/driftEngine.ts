import { TelemetryEvent } from '../types/telemetry.js';
import { EmbeddingsClient } from '../services/embeddingsClient.js';
import { BaselineStore } from '../services/baselineStore.js';
import { cosineSimilarity } from '../utils/cosineSimilarity.js';

export interface DriftResult {
  similarityScore: number;
  driftScore: number;
  baselineId?: string;
  baselineReady: boolean;
}

/**
 * Compute drift using embeddings-based similarity.
 * Compares response embedding with baseline embedding.
 */
export async function computeDrift(
  event: TelemetryEvent,
  embeddingsClient: EmbeddingsClient,
  baselineStore: BaselineStore
): Promise<DriftResult> {
  const endpoint = event.endpoint;
  const responseText = event.response;

  // Skip drift computation for error cases or empty responses
  if (event.status === 'error' || !responseText || responseText.length === 0) {
    return {
      similarityScore: 1.0,
      driftScore: 0.0,
      baselineId: `${endpoint}-error`,
      baselineReady: false,
    };
  }

  try {
    // Get embedding for current response
    const responseEmbedding = await embeddingsClient.getEmbedding(responseText);

    // Get or create baseline
    let baseline = baselineStore.getBaseline(endpoint);
    const baselineReady = baselineStore.isBaselineReady(endpoint);

    if (!baseline) {
      // Create initial baseline
      baselineStore.updateBaseline(endpoint, responseEmbedding, event);
      return {
        similarityScore: 1.0,
        driftScore: 0.0,
        baselineId: `${endpoint}-initial`,
        baselineReady: false,
      };
    }

    // Calculate cosine similarity
    const similarity = cosineSimilarity(responseEmbedding, baseline.embedding);
    
    // Clamp similarity to [0, 1] range
    // Note: Text embeddings are non-negative, so cosine similarity is typically [0, 1]
    // If negative values occur, clamp to 0
    const clampedSimilarity = Math.max(0, Math.min(1, similarity));
    
    // Drift score is inverse of similarity
    const driftScore = 1 - clampedSimilarity;

    // Update baseline with exponential moving average
    baselineStore.updateBaseline(endpoint, responseEmbedding, event);

    return {
      similarityScore: clampedSimilarity,
      driftScore,
      baselineId: `${endpoint}-${baseline.sampleCount}`,
      baselineReady,
    };
  } catch (error) {
    console.error(`[DriftEngine] Error computing drift for ${event.requestId}:`, error);
    // Return default values on error
    return {
      similarityScore: 1.0,
      driftScore: 0.0,
      baselineId: `${endpoint}-error`,
      baselineReady: false,
    };
  }
}

