# ---- Builder ----
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# not read at container runtime — so the backend URL has to be supplied as
# a build argument (docker build --build-arg NEXT_PUBLIC_API_URL=...), not
# just as a runtime `environment:` entry in docker-compose, or production
# builds would silently ship pointing at the next.config.js default.
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ---- Runtime ----
# `output: 'standalone'` (next.config.js) produces a minimal self-contained
# server bundle, so the runtime image doesn't need the full node_modules
# (including devDependencies) copied in — just these three pieces.
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
