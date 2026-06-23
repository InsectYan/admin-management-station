FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

ENV NODE_ENV=production
EXPOSE 7001

CMD ["npx", "egg-scripts", "start", "--title=menu-master-backend", "--workers=1"]
