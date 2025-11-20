import { EmbeddingsClient } from './src/services/embeddingsClient.js';
import { loadConfig } from './src/config.js';

async function testEmbeddings() {
  const config = loadConfig();
  
  console.log(`Testing embeddings with:`);
  console.log(`  Project: ${config.vertex.projectId}`);
  console.log(`  Location: ${config.vertex.location}`);
  console.log(`  Model: ${config.vertex.embeddingModel}`);
  console.log('');

  const client = new EmbeddingsClient(config.vertex);
  const testText = 'This is a test message for embeddings.';

  try {
    console.log('Getting embedding...');
    const embedding = await client.getEmbedding(testText);
    
    console.log(`✓ Success! Got embedding with ${embedding.length} dimensions`);
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`  Embedding norm: ${Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)).toFixed(4)}`);
    
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEmbeddings().catch(console.error);
