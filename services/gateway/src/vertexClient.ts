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

    // Try multiple model names/formats with fallback
    const modelVariants = this.getModelVariants(this.config.model);
    
    let lastError: Error | null = null;
    
    for (const modelName of modelVariants) {
      // Try both preview and non-preview APIs
      const apiVersions = [
        () => this.vertexAI!.preview.getGenerativeModel({ model: modelName }),
        () => this.vertexAI!.getGenerativeModel({ model: modelName }),
      ];

      for (const getModel of apiVersions) {
        try {
          const model = getModel();

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

          console.log(`[VertexClient] Successfully used model: ${modelName}`);
          
          return {
            text,
            tokensIn: usageMetadata?.promptTokenCount || 0,
            tokensOut: usageMetadata?.candidatesTokenCount || 0,
            modelName: modelName,
            modelVersion: '1.0',
          };
        } catch (error: any) {
          lastError = error;
          // If it's a 404, try next API version or model variant
          if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
            // Try next API version if available, otherwise continue to next model
            continue;
          }
          // For authentication/permission errors, provide helpful message
          if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
            throw new Error(
              `Permission denied accessing Vertex AI. ` +
              `Check: 1) Service account has roles/aiplatform.user role, ` +
              `2) Vertex AI API is enabled, 3) Billing is enabled. ` +
              `Original error: ${error.message}`
            );
          }
          // For other errors, try next API version first
          continue;
        }
      }
    }

    // All models failed
    throw new Error(
      `Failed to use any model variant. Last error: ${lastError?.message}. ` +
      `Tried models: ${modelVariants.join(', ')}. ` +
      `Please check: 1) Model availability in ${this.config.location}, ` +
      `2) Vertex AI API is enabled, 3) Service account has aiplatform.user role.`
    );
  }

  /**
   * Get list of model variants to try (short names first, then versioned)
   */
  private getModelVariants(requestedModel: string): string[] {
    const variants: string[] = [];
    
    // If model already has version suffix, try it first
    if (requestedModel.includes('-001') || requestedModel.includes('-002')) {
      variants.push(requestedModel);
    }
    
    // Extract base model name (remove version suffix if present)
    const baseModel = requestedModel.replace(/-\d{3}$/, '');
    
    // Try short name format first (SDK often prefers this)
    variants.push(baseModel);
    
    // Then try versioned variants
    if (!requestedModel.includes('-001')) {
      variants.push(`${baseModel}-001`);
    }
    if (!requestedModel.includes('-002')) {
      variants.push(`${baseModel}-002`);
    }
    
    // Add common fallbacks
    if (baseModel.includes('pro')) {
      variants.push('gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-001');
    } else if (baseModel.includes('flash')) {
      variants.push('gemini-1.5-pro', 'gemini-1.5-pro-001');
    }
    
    // Remove duplicates while preserving order
    return Array.from(new Set(variants));
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

