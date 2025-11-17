import { Router, Request, Response } from 'express';
import { VertexClient } from '../vertexClient.js';

export function createChatRouter(vertexClient: VertexClient): Router {
  const router = Router();

  router.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await vertexClient.chatCompletion(message);

      res.json({
        response: response.text,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        modelName: response.modelName,
        modelVersion: response.modelVersion,
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

