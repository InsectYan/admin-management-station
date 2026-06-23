# 占位 Dockerfile — 实现 apps/novel-backend 后替换为真实构建
FROM node:20-alpine
WORKDIR /app
RUN echo "novel-backend not implemented" > /README.txt
EXPOSE 7002
CMD ["node", "-e", "console.log('novel API placeholder'); setInterval(()=>{}, 60000)"]
