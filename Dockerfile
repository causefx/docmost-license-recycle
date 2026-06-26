FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV ACCOUNTS_FILE=/data/accounts.json

# Install supercronic (container-native cron, picks correct arch automatically)
ARG SUPERCRONIC_VERSION=v0.2.33
ARG TARGETARCH=amd64
RUN wget -q \
    "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}" \
    -O /usr/local/bin/supercronic \
    && chmod +x /usr/local/bin/supercronic

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY entrypoint.sh /entrypoint.sh
COPY run.sh /app/run.sh
RUN chmod +x /entrypoint.sh /app/run.sh

# Mount a volume here to persist accounts.json between runs:
#   docker run -v $(pwd)/data:/data --env-file .env docmost-license-recycle
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
