import { VertexAI } from '@google-cloud/vertexai';
import { Config } from './config.js';

export interface ChatResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  modelName: string;
  modelVersion: string;
}

export class VertexClient {
  private vertexAI: VertexAI | null = null;
  private config: Config['vertex'];
  private useStub: boolean;

  constructor(config: Config['vertex'], useStub: boolean = false) {
    this.config = config;
    this.useStub = useStub;
    
    if (!useStub) {
      this.vertexAI = new VertexAI({
        project: config.projectId,
        location: config.location,
      });
    }
  }

  async chatCompletion(prompt: string): Promise<ChatResponse> {
    if (this.useStub) {
      return this.stubCompletion(prompt);
    }

    if (!this.vertexAI) {
      throw new Error('Vertex AI client not initialized');
    }

    const model = this.vertexAI.preview.getGenerativeModel({
      model: this.config.model,
    });

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const systemInstruction = `You are a helpful assistant. Today's date is ${currentDate}. When asked about the current date, use this date: ${currentDate}.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction,
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = response.usageMetadata;

    return {
      text,
      tokensIn: usageMetadata?.promptTokenCount || 0,
      tokensOut: usageMetadata?.candidatesTokenCount || 0,
      modelName: this.config.model,
      modelVersion: '1.0',
    };
  }

  private stubCompletion(prompt: string): ChatResponse {
    const estimatedTokensIn = Math.ceil(prompt.length / 4);
    const stubResponse = `[STUB MODE] You said: "${prompt}". This is a mock response for testing.`;
    const estimatedTokensOut = Math.ceil(stubResponse.length / 4);

    return {
      text: stubResponse,
      tokensIn: estimatedTokensIn,
      tokensOut: estimatedTokensOut,
      modelName: this.config.model,
      modelVersion: 'stub',
    };
  }
}

