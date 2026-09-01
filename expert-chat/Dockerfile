FROM node:24-alpine

WORKDIR /app

# Install dependencies first so this layer caches across source edits.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Uploaded chat attachments are served from here; mount a volume in production.
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
