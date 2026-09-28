FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY src ./src
RUN npm run build:console

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-console ./dist-console
RUN mkdir -p /app/.game-save && chown node:node /app/.game-save

ENV NODE_ENV=production
USER node
CMD ["node", "dist-console/index.js"]
