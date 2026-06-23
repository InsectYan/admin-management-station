# Pi Agent 服务镜像（实现 apps/agent-server/src 后生效）
# 对齐 cartoon-agent deploy/config/Dockerfile
FROM node:22-alpine
WORKDIR /app
# COPY src/package*.json ./
# RUN npm ci --omit=dev
# COPY src/ ./
EXPOSE 7003
CMD ["node", "-e", "console.log('agent-server placeholder — implement apps/agent-server/src'); setInterval(()=>{}, 1e9)"]
