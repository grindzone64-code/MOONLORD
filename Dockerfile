FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "index.js"]

