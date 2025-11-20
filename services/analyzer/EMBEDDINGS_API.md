# Embeddings API Notes

## Current Status

The embeddings API is implemented but may need adjustments based on:
- Available embedding models in your region
- Correct API endpoint format
- Model name format

## Current Implementation

- Uses REST API: `https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:predict`
- Model: `textembedding-gecko@003` (configurable via `VERTEX_EMBEDDING_MODEL`)
- Fallback: Returns random 768-dim vector if API fails (allows system to continue)

## Testing

Run the test script:
```bash
cd services/analyzer
npx tsx test-embeddings.ts
```

## Troubleshooting

**404 Error - Model Not Found:**
- Check available models: `gcloud ai models list --region={region}`
- Try different regions (us-central1, us-east4)
- Try different model names:
  - `textembedding-gecko@003`
  - `textembedding-gecko@001`
  - `gemini-embedding-001`

**API Format:**
- Verify the REST API endpoint format matches Vertex AI documentation
- Check if embeddings use a different endpoint than `:predict`

## Next Steps

1. Verify correct embedding model name for your region
2. Test with actual API to confirm response format
3. Update `embeddingsClient.ts` with correct API if needed
4. Remove fallback once real embeddings work

## Current Behavior

- System works with fallback vectors (random 768-dim)
- Drift detection functions but scores are less meaningful
- Can be fixed once correct embeddings API is confirmed

