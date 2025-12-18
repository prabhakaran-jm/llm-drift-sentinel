import rateLimit from 'express-rate-limit';
import tracer from 'dd-trace';

/**
 * Rate limiter for chat API endpoints.
 * Limits to 60 requests per minute per IP.
 */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    // Emit Datadog metric for rate limit exceeded
    if (tracer.dogstatsd) {
      tracer.dogstatsd.increment('llm.rate_limit.exceeded', 1, {
        endpoint: req.path || 'unknown',
        method: req.method || 'unknown',
      });
    }

    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

