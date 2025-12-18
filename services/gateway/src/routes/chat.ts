import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import tracer from 'dd-trace';
import { VertexClient } from '../vertexClient.js';
import { TelemetryPublisher } from '../services/telemetryPublisher.js';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';
import { calculateDemoScores } from '../utils/demoScorer.js';

export function createChatRouter(
  vertexClient: VertexClient,
  telemetryPublisher: TelemetryPublisher,
  config: Config
): Router {
  const router = Router();

  router.post('/api/chat', async (req: Request, res: Response) => {
    // Get active span for APM tracing
    const span = tracer.scope().active();
    const requestId = uuidv4();
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;

    // Set trace tags
    span?.setTag('request.id', requestId);
    span?.setTag('llm.model', config.vertex.model);
    span?.setTag('llm.endpoint', '/api/chat');

    try {
      const { message } = req.body;

      // Input validation
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          details: 'Message must be a non-empty string',
        });
      }

      // Length validation
      if (message.length > 10000) {
        return res.status(400).json({
          error: 'Message too long',
          details: 'Maximum message length is 10,000 characters',
          maxLength: 10000,
        });
      }

      // Sanitize: trim and limit length
      const sanitizedMessage = message.trim();
      
      if (sanitizedMessage.length === 0) {
        return res.status(400).json({
          error: 'Empty message',
          details: 'Message cannot be empty or whitespace only',
        });
      }

      const response = await vertexClient.chatCompletion(sanitizedMessage);
      const latencyMs = Date.now() - startTime;

      // Calculate demo scores for frontend visualization
      const demoScores = calculateDemoScores(sanitizedMessage, response.text);

      // Set APM trace tags for successful response
      span?.setTag('llm.tokens.in', response.tokensIn);
      span?.setTag('llm.tokens.out', response.tokensOut);
      span?.setTag('llm.tokens.total', response.tokensIn + response.tokensOut);
      span?.setTag('llm.latency_ms', latencyMs);
      span?.setTag('llm.response.length', response.text.length);
      span?.setTag('llm.safety.score', demoScores.safetyScore);
      span?.setTag('llm.safety.label', demoScores.safetyLabel);
      span?.setTag('llm.drift.score', demoScores.driftScore);

      const telemetryEvent: TelemetryEvent = {
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/api/chat',
        method: 'POST',
        prompt: sanitizedMessage,
        promptLength: sanitizedMessage.length,
        response: response.text,
        responseLength: response.text.length,
        modelName: response.modelName,
        modelVersion: response.modelVersion,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        tokensTotal: response.tokensIn + response.tokensOut,
        latencyMs,
        status,
        environment: config.environment,
        service: 'gateway',
      };

      await telemetryPublisher.publish(telemetryEvent);

      res.json({
        requestId,
        response: response.text,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        modelName: response.modelName,
        modelVersion: response.modelVersion,
        // Add safety and drift scores for frontend visualization
        safetyScore: demoScores.safetyScore,
        safetyLabel: demoScores.safetyLabel,
        driftScore: demoScores.driftScore,
        baselineReady: demoScores.baselineReady,
      });
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const latencyMs = Date.now() - startTime;

      // Check for rate limit errors (429)
      let httpStatus = 500;
      let errorType = 'server_error';
      let userFriendlyMessage = 'Failed to process chat request';
      
      // Check if it's a Vertex AI ClientError with 429 status
      if (error && typeof error === 'object' && 'status' in error) {
        const statusCode = (error as any).status;
        if (statusCode === 429) {
          httpStatus = 429;
          errorType = 'rate_limit';
          userFriendlyMessage = 'Rate limit exceeded';
          errorMessage = 'Vertex AI rate limit exceeded. Please try again in a few moments.';
          span?.setTag('error.rate_limit', true);
        }
      }
      
      // Also check error message for 429 indicators
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        httpStatus = 429;
        errorType = 'rate_limit';
        userFriendlyMessage = 'Rate limit exceeded';
        if (!errorMessage.includes('try again')) {
          errorMessage = 'Vertex AI rate limit exceeded. Please try again in a few moments.';
        }
        span?.setTag('error.rate_limit', true);
      }

      // Set APM trace tags for error
      span?.setTag('error', true);
      span?.setTag('error.message', errorMessage);
      span?.setTag('error.type', error instanceof Error ? error.constructor.name : 'Unknown');
      span?.setTag('error.http_status', httpStatus);

      console.error('Chat error:', error);

      const telemetryEvent: TelemetryEvent = {
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/api/chat',
        method: 'POST',
        prompt: req.body.message || '',
        promptLength: req.body.message?.length || 0,
        response: '',
        responseLength: 0,
        modelName: config.vertex.model,
        modelVersion: 'unknown',
        tokensIn: 0,
        tokensOut: 0,
        tokensTotal: 0,
        latencyMs,
        status,
        errorMessage,
        environment: config.environment,
        service: 'gateway',
      };

      await telemetryPublisher.publish(telemetryEvent);

      res.status(httpStatus).json({
        requestId,
        error: userFriendlyMessage,
        details: errorMessage,
        errorType,
        ...(httpStatus === 429 && { retryAfter: 60 }), // Suggest retry after 60 seconds
      });
    }
  });

  // Feedback endpoint
  router.post('/api/feedback', async (req: Request, res: Response) => {
    const { requestId, rating, comment } = req.body;
    const span = tracer.scope().active();

    if (span) {
      span.setTag('request.id', requestId);
      span.setTag('feedback.rating', rating);
      if (comment) span.setTag('feedback.comment', comment);
    }

    try {
      if (!requestId || !['positive', 'negative'].includes(rating)) {
        res.status(400).json({ error: 'Invalid feedback data' });
        return;
      }

      // Log feedback for ingestion
      console.log(JSON.stringify({
        level: 'info',
        message: 'User Feedback Received',
        requestId,
        rating,
        comment: comment || '',
        event: 'user_feedback',
        timestamp: new Date().toISOString()
      }));

      // In a real app, we might write this to BigQuery too
      // For now, Datadog Logs will pick this up via the JSON structure

      res.json({ status: 'success' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  });

  return router;
}

