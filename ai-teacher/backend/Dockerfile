FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/server.js"]
