import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { VertexClient } from '../vertexClient.js';
import { TelemetryPublisher } from '../services/telemetryPublisher.js';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';

export function createChatRouter(
  vertexClient: VertexClient,
  telemetryPublisher: TelemetryPublisher,
  config: Config
): Router {
  const router = Router();

  router.post('/api/chat', async (req: Request, res: Response) => {
    const requestId = uuidv4();
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;

    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await vertexClient.chatCompletion(message);
      const latencyMs = Date.now() - startTime;

      const telemetryEvent: TelemetryEvent = {
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/api/chat',
        method: 'POST',
        prompt: message,
        promptLength: message.length,
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
      });
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const latencyMs = Date.now() - startTime;

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

      res.status(500).json({
        requestId,
        error: 'Failed to process chat request',
        details: errorMessage,
      });
    }
  });

  return router;
}

