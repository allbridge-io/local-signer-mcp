FROM node:24-alpine AS build

RUN apk update && \
    apk upgrade --available --no-cache && \
    apk add --no-cache bash g++ make python3 && \
    rm -rf /var/cache/apk/*

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY .npmrc ./
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY src ./src
COPY test ./test
COPY tsconfig.json ./
COPY tsconfig.spec.json ./
COPY jest.config.cjs ./
COPY eslint.config.mjs ./
COPY README.md ./
COPY docs ./docs
COPY examples ./examples
COPY .env.example ./

RUN pnpm install --frozen-lockfile

RUN pnpm build

FROM node:24-alpine

RUN apk update && \
    apk upgrade --available --no-cache && \
    rm -rf /var/cache/apk/*

WORKDIR /app
ENV NODE_ENV=production
ENV MCP_TRANSPORT=stdio

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

USER node

CMD ["node", "dist/index.js"]
