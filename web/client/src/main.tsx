import React from 'react'
import ReactDOM from 'react-dom/client'
import { datadogRum } from '@datadog/browser-rum';
import App from './App.tsx'
import './index.css'

// Initialize Datadog RUM (only if credentials are provided)
const ddApplicationId = import.meta.env.VITE_DD_APPLICATION_ID;
const ddClientToken = import.meta.env.VITE_DD_CLIENT_TOKEN;

if (ddApplicationId && ddClientToken) {
  datadogRum.init({
    applicationId: ddApplicationId,
    clientToken: ddClientToken,
    site: import.meta.env.VITE_DD_SITE || 'datadoghq.com',
    service: 'llm-sentinel-client',
    env: import.meta.env.VITE_ENVIRONMENT || 'dev',
    version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });
} else if (import.meta.env.DEV) {
  console.log('[Datadog RUM] Not initialized - missing VITE_DD_APPLICATION_ID or VITE_DD_CLIENT_TOKEN');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

