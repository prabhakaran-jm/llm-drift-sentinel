import { TelemetryEvent } from '../types/telemetry.js';
import { SafetyResult } from './safetyEngine.js';

export type AttackPattern = 
  | 'COORDINATED_JAILBREAK' 
  | 'BRUTE_FORCE_PII' 
  | 'PROMPT_INJECTION_CAMPAIGN'
  | 'DISTRIBUTED_ATTACK';

export interface PatternDetectionResult {
  patternDetected: boolean;
  patternType?: AttackPattern;
  confidence: number; // 0-1
  affectedRequests: number;
  timeWindow: number; // seconds
  details: string;
  requestIds: string[];
  firstSeen: string;
  lastSeen: string;
}

interface EventRecord {
  event: TelemetryEvent;
  safetyResult: SafetyResult;
  timestamp: number;
}

/**
 * Pattern Detection Engine
 * Detects coordinated attack campaigns by analyzing event patterns over time windows.
 */
export class PatternDetector {
  private eventHistory: EventRecord[] = [];
  private readonly maxHistorySize = 5000; // Keep last 5000 events
  private readonly maxHistoryAge = 3600000; // 1 hour in milliseconds

  // Pattern detection thresholds
  private readonly JAILBREAK_WINDOW = 300000; // 5 minutes
  private readonly JAILBREAK_THRESHOLD = 5; // 5+ jailbreak attempts in window
  private readonly JAILBREAK_SIMILARITY_THRESHOLD = 0.7; // 70% similarity for coordination

  private readonly PII_WINDOW = 600000; // 10 minutes
  private readonly PII_THRESHOLD = 10; // 10+ PII extraction attempts
  private readonly PII_SIMILARITY_THRESHOLD = 0.6; // 60% similarity for brute force

  private readonly INJECTION_WINDOW = 180000; // 3 minutes
  private readonly INJECTION_THRESHOLD = 8; // 8+ injection attempts
  private readonly INJECTION_SIMILARITY_THRESHOLD = 0.65; // 65% similarity for campaign

  /**
   * Record an event for pattern analysis
   */
  recordEvent(event: TelemetryEvent, safetyResult: SafetyResult): void {
    const record: EventRecord = {
      event,
      safetyResult,
      timestamp: new Date(event.timestamp).getTime(),
    };

    this.eventHistory.push(record);

    // Clean old events
    this.cleanHistory();
  }

  /**
   * Detect attack patterns in recent events
   */
  detectPatterns(): PatternDetectionResult[] {
    this.cleanHistory();
    
    const results: PatternDetectionResult[] = [];

    // Detect coordinated jailbreak attacks
    const jailbreakPattern = this.detectCoordinatedJailbreak();
    if (jailbreakPattern.patternDetected) {
      results.push(jailbreakPattern);
    }

    // Detect brute force PII extraction
    const piiPattern = this.detectBruteForcePII();
    if (piiPattern.patternDetected) {
      results.push(piiPattern);
    }

    // Detect prompt injection campaigns
    const injectionPattern = this.detectInjectionCampaign();
    if (injectionPattern.patternDetected) {
      results.push(injectionPattern);
    }

    return results;
  }

  /**
   * Detect coordinated jailbreak attacks
   * Multiple similar jailbreak attempts within a short time window
   */
  private detectCoordinatedJailbreak(): PatternDetectionResult {
    const now = Date.now();
    const windowStart = now - this.JAILBREAK_WINDOW;
    
    // Filter events in time window with jailbreak labels
    const jailbreakEvents = this.eventHistory.filter(
      r => r.timestamp >= windowStart && 
           r.safetyResult.safetyLabel === 'JAILBREAK'
    );

    if (jailbreakEvents.length < this.JAILBREAK_THRESHOLD) {
      return {
        patternDetected: false,
        confidence: 0,
        affectedRequests: 0,
        timeWindow: this.JAILBREAK_WINDOW / 1000,
        details: '',
        requestIds: [],
        firstSeen: '',
        lastSeen: '',
      };
    }

    // Group by similarity (simple text similarity for now)
    const groups = this.groupBySimilarity(
      jailbreakEvents,
      this.JAILBREAK_SIMILARITY_THRESHOLD,
      (r) => r.event.prompt
    );

    // Find largest group (coordinated attack)
    const largestGroup = groups.reduce((max, group) => 
      group.length > max.length ? group : max, groups[0] || []
    );

    if (largestGroup.length >= this.JAILBREAK_THRESHOLD) {
      const requestIds = largestGroup.map(r => r.event.requestId);
      const timestamps = largestGroup.map(r => r.timestamp);
      
      return {
        patternDetected: true,
        patternType: 'COORDINATED_JAILBREAK',
        confidence: Math.min(1.0, largestGroup.length / (this.JAILBREAK_THRESHOLD * 2)),
        affectedRequests: largestGroup.length,
        timeWindow: this.JAILBREAK_WINDOW / 1000,
        details: `Detected ${largestGroup.length} coordinated jailbreak attempts with ${(this.JAILBREAK_SIMILARITY_THRESHOLD * 100).toFixed(0)}%+ similarity within ${this.JAILBREAK_WINDOW / 1000}s window`,
        requestIds,
        firstSeen: new Date(Math.min(...timestamps)).toISOString(),
        lastSeen: new Date(Math.max(...timestamps)).toISOString(),
      };
    }

    return {
      patternDetected: false,
      confidence: 0,
      affectedRequests: 0,
      timeWindow: this.JAILBREAK_WINDOW / 1000,
      details: '',
      requestIds: [],
      firstSeen: '',
      lastSeen: '',
    };
  }

  /**
   * Detect brute force PII extraction
   * Multiple similar PII extraction attempts over a time window
   */
  private detectBruteForcePII(): PatternDetectionResult {
    const now = Date.now();
    const windowStart = now - this.PII_WINDOW;
    
    // Filter events in time window with PII labels
    const piiEvents = this.eventHistory.filter(
      r => r.timestamp >= windowStart && 
           r.safetyResult.safetyLabel === 'PII'
    );

    if (piiEvents.length < this.PII_THRESHOLD) {
      return {
        patternDetected: false,
        confidence: 0,
        affectedRequests: 0,
        timeWindow: this.PII_WINDOW / 1000,
        details: '',
        requestIds: [],
        firstSeen: '',
        lastSeen: '',
      };
    }

    // Group by similarity (looking for repeated extraction patterns)
    const groups = this.groupBySimilarity(
      piiEvents,
      this.PII_SIMILARITY_THRESHOLD,
      (r) => r.event.prompt
    );

    // Check if any group shows brute force pattern (many similar attempts)
    const bruteForceGroup = groups.find(group => group.length >= this.PII_THRESHOLD);

    if (bruteForceGroup) {
      const requestIds = bruteForceGroup.map(r => r.event.requestId);
      const timestamps = bruteForceGroup.map(r => r.timestamp);
      
      return {
        patternDetected: true,
        patternType: 'BRUTE_FORCE_PII',
        confidence: Math.min(1.0, bruteForceGroup.length / (this.PII_THRESHOLD * 1.5)),
        affectedRequests: bruteForceGroup.length,
        timeWindow: this.PII_WINDOW / 1000,
        details: `Detected ${bruteForceGroup.length} brute force PII extraction attempts with ${(this.PII_SIMILARITY_THRESHOLD * 100).toFixed(0)}%+ similarity within ${this.PII_WINDOW / 1000}s window`,
        requestIds,
        firstSeen: new Date(Math.min(...timestamps)).toISOString(),
        lastSeen: new Date(Math.max(...timestamps)).toISOString(),
      };
    }

    return {
      patternDetected: false,
      confidence: 0,
      affectedRequests: 0,
      timeWindow: this.PII_WINDOW / 1000,
      details: '',
      requestIds: [],
      firstSeen: '',
      lastSeen: '',
    };
  }

  /**
   * Detect prompt injection campaigns
   * Multiple injection attempts with similar patterns
   */
  private detectInjectionCampaign(): PatternDetectionResult {
    const now = Date.now();
    const windowStart = now - this.INJECTION_WINDOW;
    
    // Filter events in time window with injection labels
    const injectionEvents = this.eventHistory.filter(
      r => r.timestamp >= windowStart && 
           r.safetyResult.safetyLabel === 'PROMPT_INJECTION'
    );

    if (injectionEvents.length < this.INJECTION_THRESHOLD) {
      return {
        patternDetected: false,
        confidence: 0,
        affectedRequests: 0,
        timeWindow: this.INJECTION_WINDOW / 1000,
        details: '',
        requestIds: [],
        firstSeen: '',
        lastSeen: '',
      };
    }

    // Group by similarity (campaign pattern)
    const groups = this.groupBySimilarity(
      injectionEvents,
      this.INJECTION_SIMILARITY_THRESHOLD,
      (r) => r.event.prompt
    );

    // Find largest group (campaign)
    const largestGroup = groups.reduce((max, group) => 
      group.length > max.length ? group : max, groups[0] || []
    );

    if (largestGroup.length >= this.INJECTION_THRESHOLD) {
      const requestIds = largestGroup.map(r => r.event.requestId);
      const timestamps = largestGroup.map(r => r.timestamp);
      
      return {
        patternDetected: true,
        patternType: 'PROMPT_INJECTION_CAMPAIGN',
        confidence: Math.min(1.0, largestGroup.length / (this.INJECTION_THRESHOLD * 1.5)),
        affectedRequests: largestGroup.length,
        timeWindow: this.INJECTION_WINDOW / 1000,
        details: `Detected ${largestGroup.length} prompt injection campaign attempts with ${(this.INJECTION_SIMILARITY_THRESHOLD * 100).toFixed(0)}%+ similarity within ${this.INJECTION_WINDOW / 1000}s window`,
        requestIds,
        firstSeen: new Date(Math.min(...timestamps)).toISOString(),
        lastSeen: new Date(Math.max(...timestamps)).toISOString(),
      };
    }

    return {
      patternDetected: false,
      confidence: 0,
      affectedRequests: 0,
      timeWindow: this.INJECTION_WINDOW / 1000,
      details: '',
      requestIds: [],
      firstSeen: '',
      lastSeen: '',
    };
  }

  /**
   * Group events by text similarity
   * Uses simple Jaccard similarity on word sets
   */
  private groupBySimilarity(
    events: EventRecord[],
    threshold: number,
    extractText: (r: EventRecord) => string
  ): EventRecord[][] {
    if (events.length === 0) {
      return [];
    }

    const groups: EventRecord[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < events.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      const group: EventRecord[] = [events[i]];
      processed.add(i);

      for (let j = i + 1; j < events.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const similarity = this.calculateSimilarity(
          extractText(events[i]),
          extractText(events[j])
        );

        if (similarity >= threshold) {
          group.push(events[j]);
          processed.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Calculate Jaccard similarity between two texts
   * Returns value between 0 and 1
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * Clean old events from history
   */
  private cleanHistory(): void {
    const now = Date.now();
    const cutoff = now - this.maxHistoryAge;

    // Remove events older than maxHistoryAge
    this.eventHistory = this.eventHistory.filter(r => r.timestamp >= cutoff);

    // Limit to maxHistorySize
    if (this.eventHistory.length > this.maxHistorySize) {
      // Keep most recent events
      this.eventHistory = this.eventHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get statistics about detected patterns
   */
  getStatistics(): {
    totalEvents: number;
    jailbreakCount: number;
    piiCount: number;
    injectionCount: number;
  } {
    const now = Date.now();
    const windowStart = now - Math.max(
      this.JAILBREAK_WINDOW,
      this.PII_WINDOW,
      this.INJECTION_WINDOW
    );

    const recentEvents = this.eventHistory.filter(r => r.timestamp >= windowStart);

    return {
      totalEvents: recentEvents.length,
      jailbreakCount: recentEvents.filter(r => r.safetyResult.safetyLabel === 'JAILBREAK').length,
      piiCount: recentEvents.filter(r => r.safetyResult.safetyLabel === 'PII').length,
      injectionCount: recentEvents.filter(r => r.safetyResult.safetyLabel === 'PROMPT_INJECTION').length,
    };
  }
}

