import rateLimit from 'express-rate-limit';

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
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

