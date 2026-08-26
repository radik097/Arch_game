FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server/ ./server/
COPY src/ ./src/
COPY tsconfig.server.json ./
RUN npm run build:server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY src/ ./src/
COPY tsconfig.server.json ./
EXPOSE 8787
CMD ["npm", "run", "start:server"]
