# ---- Builder ----
FROM node:18-alpine AS builder
WORKDIR /app

# `prisma generate` (run via the postinstall hook below) only needs
# DATABASE_URL to *resolve* — it parses the schema but never connects to a
# database at generate time. This placeholder is overridden by the real
# value at container runtime (via docker-compose `environment:` or your
# deployment platform's env config); it only needs to exist for this build
# step to succeed.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"

# Copy the manifest and Prisma schema before installing, so postinstall's
# `prisma generate` has the schema file it needs — and so this layer is
# only invalidated when dependencies or the schema actually change, not on
# every source edit.
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 5000
CMD ["npm", "start"]
