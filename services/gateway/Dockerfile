# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY services/gateway/package*.json ./
COPY services/gateway/tsconfig.json ./
# Copy tsconfig.base.json and place it where tsconfig.json expects it (../../tsconfig.base.json)
COPY tsconfig.base.json ./tsconfig.base.json.tmp
RUN mkdir -p ../.. && cp ./tsconfig.base.json.tmp ../../tsconfig.base.json && rm ./tsconfig.base.json.tmp

# Install dependencies (use npm install if package-lock.json doesn't exist)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY services/gateway/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/gateway/package*.json ./

# Install production dependencies only (use npm install if package-lock.json doesn't exist)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080

# Start the application
CMD ["node", "dist/index.js"]

