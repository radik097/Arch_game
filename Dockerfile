FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY tsconfig.server.json ./
RUN npm run build:server
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
