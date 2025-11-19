export interface TelemetryEvent {
  requestId: string;
  timestamp: string;
  endpoint: string;
  method: string;
  
  // Request data
  prompt: string;
  promptLength: number;
  
  // Response data
  response: string;
  responseLength: number;
  
  // Model info
  modelName: string;
  modelVersion: string;
  
  // Token usage
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  
  // Latency (milliseconds)
  latencyMs: number;
  
  // Status
  status: 'success' | 'error';
  errorMessage?: string;
  
  // Metadata
  environment?: string;
  service: string;
}

