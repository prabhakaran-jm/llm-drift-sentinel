import { TelemetryEvent } from '../types/telemetry.js';
import { EmbeddingsClient } from '../services/embeddingsClient.js';

/**
 * Model pricing (per 1K tokens) - approximate Vertex AI/Gemini pricing
 * These are estimates and should be updated based on actual pricing
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash-exp': { input: 0.075, output: 0.30 }, // $0.075/$0.30 per 1M tokens
  'gemini-2.0-flash-thinking-exp': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-pro': { input: 0.50, output: 1.50 },
  'text-embedding-004': { input: 0.01, output: 0 }, // Embeddings are input-only
  'textembedding-gecko@003': { input: 0.01, output: 0 },
  'textembedding-gecko@001': { input: 0.01, output: 0 },
};

/**
 * Cheaper alternative models for recommendations
 */
const MODEL_ALTERNATIVES: Record<string, string[]> = {
  'gemini-1.5-pro': ['gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  'gemini-pro': ['gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  'gemini-1.5-flash': ['gemini-2.0-flash-exp'],
};

export interface CostRecommendation {
  type: 'model_downgrade' | 'enable_caching' | 'optimize_prompts' | 'batch_requests';
  priority: 'high' | 'medium' | 'low';
  estimatedSavings: number; // USD per month
  description: string;
  action: string;
  model?: string;
  alternativeModel?: string;
}

export interface CostAnalysis {
  currentCost: number; // USD per month (estimated)
  projectedCost: number; // USD per month with recommendations
  recommendations: CostRecommendation[];
  modelUsage: Map<string, { requests: number; tokens: number; cost: number }>;
  cacheHitRate?: number;
}

/**
 * Cost Optimization Engine
 * Analyzes model usage patterns and generates cost-saving recommendations
 */
export class CostOptimizer {
  private eventHistory: TelemetryEvent[] = [];
  private readonly maxHistorySize = 1000; // Keep last 1000 events for analysis
  private embeddingsClient?: EmbeddingsClient;

  constructor(embeddingsClient?: EmbeddingsClient) {
    this.embeddingsClient = embeddingsClient;
  }

  /**
   * Record an event for cost analysis
   */
  recordEvent(event: TelemetryEvent): void {
    this.eventHistory.push(event);
    
    // Keep only recent history
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Analyze costs and generate recommendations
   */
  analyzeCosts(): CostAnalysis {
    if (this.eventHistory.length === 0) {
      return {
        currentCost: 0,
        projectedCost: 0,
        recommendations: [],
        modelUsage: new Map(),
      };
    }

    // Calculate current costs
    const modelUsage = this.calculateModelUsage();
    const currentCost = this.calculateMonthlyCost(modelUsage);
    
    // Get cache hit rate if available
    const cacheHitRate = this.embeddingsClient?.getCacheStats().hitRate;

    // Generate recommendations
    const recommendations = this.generateRecommendations(modelUsage, cacheHitRate);

    // Calculate projected cost with recommendations
    const projectedCost = this.calculateProjectedCost(currentCost, recommendations);

    return {
      currentCost,
      projectedCost,
      recommendations,
      modelUsage,
      cacheHitRate,
    };
  }

  /**
   * Calculate usage statistics per model
   */
  private calculateModelUsage(): Map<string, { requests: number; tokens: number; cost: number }> {
    const usage = new Map<string, { requests: number; tokens: number; cost: number }>();

    for (const event of this.eventHistory) {
      const model = event.modelName;
      const existing = usage.get(model) || { requests: 0, tokens: 0, cost: 0 };

      const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-1.5-pro']; // Default fallback
      // Pricing is per 1M tokens, so divide by 1M
      const cost = (event.tokensIn / 1000000) * pricing.input + 
                   (event.tokensOut / 1000000) * pricing.output;

      usage.set(model, {
        requests: existing.requests + 1,
        tokens: existing.tokens + event.tokensTotal,
        cost: existing.cost + cost,
      });
    }

    return usage;
  }

  /**
   * Calculate estimated monthly cost based on current usage
   */
  private calculateMonthlyCost(modelUsage: Map<string, { requests: number; tokens: number; cost: number }>): number {
    // Calculate cost per event on average
    let totalCost = 0;
    for (const [, stats] of modelUsage) {
      totalCost += stats.cost;
    }

    // Extrapolate to monthly (assuming 30 days, 24 hours)
    const eventsPerHour = this.eventHistory.length / (this.getAnalysisWindowHours() || 1);
    const eventsPerMonth = eventsPerHour * 24 * 30;
    const costPerEvent = totalCost / this.eventHistory.length;
    
    return costPerEvent * eventsPerMonth;
  }

  /**
   * Get analysis window in hours (based on event timestamps)
   */
  private getAnalysisWindowHours(): number {
    if (this.eventHistory.length < 2) {
      return 1; // Default to 1 hour
    }

    const sorted = [...this.eventHistory].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const first = new Date(sorted[0].timestamp);
    const last = new Date(sorted[sorted.length - 1].timestamp);
    const hours = (last.getTime() - first.getTime()) / (1000 * 60 * 60);
    
    return Math.max(hours, 0.1); // Minimum 0.1 hours
  }

  /**
   * Generate cost-saving recommendations
   */
  private generateRecommendations(
    modelUsage: Map<string, { requests: number; tokens: number; cost: number }>,
    cacheHitRate?: number
  ): CostRecommendation[] {
    const recommendations: CostRecommendation[] = [];

    // 1. Model downgrade recommendations
    for (const [model, stats] of modelUsage.entries()) {
      const alternatives = MODEL_ALTERNATIVES[model];
      if (alternatives && alternatives.length > 0) {
        const alternative = alternatives[0];
        const currentPricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-1.5-pro'];
        const altPricing = MODEL_PRICING[alternative] || MODEL_PRICING['gemini-1.5-flash'];
        
        // Calculate savings (pricing is per 1M tokens)
        const currentCostPer1M = (currentPricing.input + currentPricing.output) / 2;
        const altCostPer1M = (altPricing.input + altPricing.output) / 2;
        const savingsPer1M = currentCostPer1M - altCostPer1M;
        
        if (savingsPer1M > 0) {
          const monthlySavings = (stats.tokens / 1000000) * savingsPer1M * (30 * 24 / this.getAnalysisWindowHours());
          
          if (monthlySavings > 10) { // Only recommend if savings > $10/month
            recommendations.push({
              type: 'model_downgrade',
              priority: monthlySavings > 100 ? 'high' : 'medium',
              estimatedSavings: monthlySavings,
              description: `${model} is expensive. Consider using ${alternative} for similar performance at lower cost.`,
              action: `Switch ${stats.requests} requests/month from ${model} to ${alternative}`,
              model,
              alternativeModel: alternative,
            });
          }
        }
      }
    }

    // 2. Caching recommendations
    if (cacheHitRate !== undefined) {
      if (cacheHitRate < 0.3) {
        const estimatedSavings = this.estimateCacheSavings(modelUsage, cacheHitRate);
        if (estimatedSavings > 10) {
          recommendations.push({
            type: 'enable_caching',
            priority: estimatedSavings > 50 ? 'high' : 'medium',
            estimatedSavings,
            description: `Current cache hit rate is ${(cacheHitRate * 100).toFixed(1)}%. Increasing to 50%+ could save significant costs.`,
            action: 'Enable response caching for repeated queries',
          });
        }
      }
    } else {
      // No cache stats available - recommend enabling caching
      const estimatedSavings = this.estimateCacheSavings(modelUsage, 0);
      if (estimatedSavings > 10) {
        recommendations.push({
          type: 'enable_caching',
          priority: 'medium',
          estimatedSavings,
          description: 'Response caching is not enabled. Enable caching to reduce redundant API calls.',
          action: 'Enable response caching for repeated queries',
        });
      }
    }

    // 3. Prompt optimization recommendations
    const avgPromptLength = this.calculateAveragePromptLength();
    if (avgPromptLength > 1000) {
      const estimatedSavings = this.estimatePromptOptimizationSavings(modelUsage, avgPromptLength);
      if (estimatedSavings > 10) {
        recommendations.push({
          type: 'optimize_prompts',
          priority: 'low',
          estimatedSavings,
          description: `Average prompt length is ${avgPromptLength.toFixed(0)} tokens. Optimizing prompts could reduce input costs.`,
          action: 'Review and optimize prompts to reduce token usage',
        });
      }
    }

    // Sort by priority and savings
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.estimatedSavings - a.estimatedSavings;
    });

    return recommendations;
  }

  /**
   * Estimate cache savings
   */
  private estimateCacheSavings(
    modelUsage: Map<string, { requests: number; tokens: number; cost: number }>,
    currentHitRate: number
  ): number {
    let totalCost = 0;
    for (const [, stats] of modelUsage) {
      totalCost += stats.cost;
    }

    const monthlyCost = totalCost * (30 * 24 / this.getAnalysisWindowHours());
    const targetHitRate = 0.5; // Target 50% cache hit rate
    const potentialSavings = monthlyCost * (targetHitRate - currentHitRate) * 0.8; // 80% of cached requests save cost

    return Math.max(0, potentialSavings);
  }

  /**
   * Calculate average prompt length
   */
  private calculateAveragePromptLength(): number {
    if (this.eventHistory.length === 0) {
      return 0;
    }

    const total = this.eventHistory.reduce((sum, event) => sum + event.tokensIn, 0);
    return total / this.eventHistory.length;
  }

  /**
   * Estimate prompt optimization savings
   */
  private estimatePromptOptimizationSavings(
    modelUsage: Map<string, { requests: number; tokens: number; cost: number }>,
    avgPromptLength: number
  ): number {
    // Assume 20% reduction in prompt length is achievable
    const reductionFactor = 0.2;
    let totalInputCost = 0;

    for (const [model, stats] of modelUsage.entries()) {
      const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-1.5-pro'];
      // Rough estimate: input tokens are ~50% of total tokens
      const inputTokens = stats.tokens * 0.5;
      const inputCost = (inputTokens / 1000000) * pricing.input;
      totalInputCost += inputCost;
    }

    const monthlyInputCost = totalInputCost * (30 * 24 / this.getAnalysisWindowHours());
    return monthlyInputCost * reductionFactor;
  }

  /**
   * Calculate projected cost with recommendations applied
   */
  private calculateProjectedCost(currentCost: number, recommendations: CostRecommendation[]): number {
    let projectedCost = currentCost;

    for (const rec of recommendations) {
      if (rec.type === 'model_downgrade' || rec.type === 'enable_caching' || rec.type === 'optimize_prompts') {
        projectedCost -= rec.estimatedSavings;
      }
    }

    return Math.max(0, projectedCost);
  }

  /**
   * Get cost per request for a specific model
   */
  getCostPerRequest(event: TelemetryEvent): number {
    const pricing = MODEL_PRICING[event.modelName] || MODEL_PRICING['gemini-1.5-pro'];
    // Pricing is per 1M tokens, so divide by 1M
    return (event.tokensIn / 1000000) * pricing.input + 
           (event.tokensOut / 1000000) * pricing.output;
  }
}

