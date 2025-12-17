import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { createHash } from 'crypto';
import { Config } from '../config.js';

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

export class EmbeddingsClient {
  private vertexAI: VertexAI;
  private projectId: string;
  private location: string;
  private model: string;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL = 3600000; // 1 hour
  private readonly maxCacheSize = 1000; // Maximum cache entries

  constructor(config: Config['vertex']) {
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.location,
    });
    this.projectId = config.projectId;
    this.location = config.location;
    this.model = config.embeddingModel;
  }

  /**
   * Hash text for cache key (simple hash for caching)
   */
  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Clean old cache entries (simple LRU - remove oldest)
   */
  private cleanCache(): void {
    if (this.cache.size <= this.maxCacheSize) {
      return;
    }

    // Remove oldest entries (simple approach - remove first 10%)
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1);
    const keysToRemove = Array.from(this.cache.keys()).slice(0, entriesToRemove);
    keysToRemove.forEach(key => this.cache.delete(key));
  }

  async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.hashText(text);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('[Embeddings] Cache hit');
      return cached.embedding;
    }

    // Cache miss - compute embedding
    // Try multiple model names and API formats
    const modelVariants = [
      this.model,
      'textembedding-gecko@003',
      'textembedding-gecko@001',
      'text-embedding-004',
    ];

    for (const modelName of modelVariants) {
      try {
        const embedding = await this.tryGetEmbedding(text, modelName);
        if (embedding) {
          // Cache the result
          this.cache.set(cacheKey, {
            embedding,
            timestamp: Date.now(),
          });

          // Clean cache if needed
          this.cleanCache();

          return embedding;
        }
      } catch (error: any) {
        // Try next model variant
        continue;
      }
    }

    // All attempts failed - use fallback
    console.warn('[Embeddings] All model variants failed, using fallback');
    const fallbackEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.01);
    
    // Don't cache fallback embeddings
    return fallbackEmbedding;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; hitRate: number } {
    // Note: hitRate would need to be tracked separately with counters
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to implement hit/miss tracking
    };
  }

  private async tryGetEmbedding(text: string, modelName: string): Promise<number[] | null> {
    try {
      // Vertex AI embeddings REST API
      const apiEndpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${modelName}:predict`;
      
      // Get auth token
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId: this.projectId,
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();

      // Try format 1: Standard predict format
      let response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              content: text,
              taskType: 'RETRIEVAL_DOCUMENT',
            },
          ],
        }),
      });

      if (response.ok) {
        const result: any = await response.json();
        const embedding = result.predictions?.[0]?.embeddings?.values;
        if (embedding && embedding.length > 0) {
          console.log(`[Embeddings] Success with ${modelName}: ${embedding.length} dimensions`);
          return embedding;
        }
      }

      // Try format 2: Alternative request format
      response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              content: text,
            },
          ],
        }),
      });

      if (response.ok) {
        const result: any = await response.json();
        const embedding = result.predictions?.[0]?.embeddings?.values || result.predictions?.[0]?.embedding?.values;
        if (embedding && embedding.length > 0) {
          console.log(`[Embeddings] Success with ${modelName} (alt format): ${embedding.length} dimensions`);
          return embedding;
        }
      }

      // If we get here, this model variant didn't work
      if (response.status !== 404) {
        const errorText = await response.text();
        console.log(`[Embeddings] ${modelName} returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
      
      return null;
    } catch (error: any) {
      // Silently fail and try next variant
      return null;
    }
  }
}
