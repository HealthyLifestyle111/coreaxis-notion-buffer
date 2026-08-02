FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=4173
ENV COREAXIS_STORAGE_DIR=/var/lib/coreaxis
RUN mkdir -p /var/lib/coreaxis
EXPOSE 4173
CMD ["sh", "-c", "node orchestrator/bootstrap.js && node studio/server.js"]
