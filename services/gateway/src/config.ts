import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  useStub: boolean;
  vertex: {
    projectId: string;
    location: string;
    model: string;
  };
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    useStub: process.env.USE_STUB === 'true',
    vertex: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      model: process.env.VERTEX_MODEL || 'gemini-1.5-pro',
    },
  };
}

