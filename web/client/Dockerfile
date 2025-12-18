# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/client/package*.json ./
COPY web/client/tsconfig.json ./
COPY web/client/tsconfig.node.json ./
COPY web/client/vite.config.ts ./
COPY web/client/index.html ./

# Install dependencies (use npm install if package-lock.json doesn't exist)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY web/client/src ./src
# Note: public directory is optional in Vite - only copy if it exists
# If you need static assets, create web/client/public/ directory

# Build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production stage - use nginx to serve static files
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx configuration
# Note: In production, the frontend will call the gateway URL directly
# The nginx proxy is only for local development
RUN echo 'server { \
    listen 8080; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

