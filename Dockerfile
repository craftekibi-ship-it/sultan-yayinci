FROM node:20-alpine

WORKDIR /app

# Bagimliliklar
COPY package.json ./
RUN npm install --omit=dev

# Uygulama
COPY . .

# state.json icin yazilabilir dizin
RUN mkdir -p data content/media

ENV NODE_ENV=production
EXPOSE 3000

# Coolify saglik kontrolu /health'e bakar
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
