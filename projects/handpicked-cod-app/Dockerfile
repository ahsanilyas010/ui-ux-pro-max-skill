FROM node:22-alpine
RUN apk add --no-cache openssl

RUN mkdir -p /data
EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
# Override with a Postgres URL in production (see README). For sqlite mount a volume at /data.
ENV DATABASE_URL="file:/data/prod.sqlite"

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
