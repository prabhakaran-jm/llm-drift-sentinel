/**
 * Anomaly Detection Engine
 * 
 * Detects statistical anomalies in drift scores using Z-score analysis.
 * Goes beyond simple thresholds to identify unusual patterns.
 */

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  threshold: number;
  mean: number;
  stdDev: number;
}

export class AnomalyDetector {
  private history: Map<string, number[]> = new Map(); // endpoint -> recent drift scores
  private readonly windowSize = 50; // Keep last 50 scores per endpoint
  private readonly anomalyThreshold = 3; // Z-score threshold (3 standard deviations)

  /**
   * Detect anomaly in drift score using statistical analysis.
   * 
   * @param endpoint - API endpoint identifier
   * @param driftScore - Current drift score to analyze
   * @returns Anomaly detection result with Z-score and statistics
   */
  detectAnomaly(endpoint: string, driftScore: number): AnomalyResult {
    const scores = this.history.get(endpoint) || [];
    scores.push(driftScore);

    // Keep only recent window
    if (scores.length > this.windowSize) {
      scores.shift();
    }
    this.history.set(endpoint, scores);

    // Need enough data for statistics (at least 10 samples)
    if (scores.length < 10) {
      return {
        isAnomaly: false,
        zScore: 0,
        threshold: 0,
        mean: 0,
        stdDev: 0,
      };
    }

    // Calculate mean
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Calculate variance and standard deviation
    const variance = scores.reduce((sum, score) => {
      return sum + Math.pow(score - mean, 2);
    }, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Z-score
    const zScore = stdDev > 0 ? (driftScore - mean) / stdDev : 0;

    // Anomaly if absolute Z-score exceeds threshold
    const threshold = mean + this.anomalyThreshold * stdDev;
    const isAnomaly = Math.abs(zScore) > this.anomalyThreshold;

    return {
      isAnomaly,
      zScore,
      threshold,
      mean,
      stdDev,
    };
  }

  /**
   * Get statistics for an endpoint.
   */
  getStats(endpoint: string): { count: number; mean: number; stdDev: number } | null {
    const scores = this.history.get(endpoint);
    if (!scores || scores.length === 0) {
      return null;
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => {
      return sum + Math.pow(score - mean, 2);
    }, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: scores.length,
      mean,
      stdDev,
    };
  }

  /**
   * Clear history for an endpoint (useful for testing or reset).
   */
  clearHistory(endpoint: string): void {
    this.history.delete(endpoint);
  }

  /**
   * Clear all history.
   */
  clearAllHistory(): void {
    this.history.clear();
  }
}

