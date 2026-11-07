FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp \
    && mkdir -p /app/bin \
    && cp /usr/local/bin/yt-dlp /app/bin/yt-dlp \
    && chmod +x /app/bin/yt-dlp \
    && yt-dlp --version \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["node", "index.js"]
