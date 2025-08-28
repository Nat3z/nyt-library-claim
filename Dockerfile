FROM oven/bun:alpine

WORKDIR /app
COPY . .
RUN apk update && apk add chromium
RUN bun install --frozen-lockfile

CMD ["bun", "cmd.ts"]