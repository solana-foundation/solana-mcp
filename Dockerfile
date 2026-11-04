# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@10.30.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.30.0
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY scripts ./scripts
COPY ingestion/sources.yaml ./ingestion/sources.yaml
COPY lib ./lib
COPY server ./server
RUN pnpm gen:sources \
    && pnpm exec tsc -p tsconfig.json \
    && pnpm prune --prod

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY public ./public
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "build/server/cloudrun.js"]
# Note: tsc with rootDir=. flattens server/cloudrun.ts → build/server/cloudrun.js
