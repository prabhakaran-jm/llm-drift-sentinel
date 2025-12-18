// API configuration
// In production, this will be set via environment variable or build-time config
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get full API URL
export function getApiUrl(path: string): string {
  if (API_BASE_URL) {
    // If API_BASE_URL is set, use it directly
    return `${API_BASE_URL}${path}`;
  }
  // Otherwise, use relative path (for nginx proxy or same origin)
  return path;
}

