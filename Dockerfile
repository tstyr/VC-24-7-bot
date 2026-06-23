FROM node:20-alpine

# Install FFmpeg, python3, and yt-dlp
# Use --break-system-packages flag for pip3 install on Alpine 3.21+
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip3 install --break-system-packages --no-cache-dir yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]
