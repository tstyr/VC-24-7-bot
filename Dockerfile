FROM node:20-alpine

# Install FFmpeg and python3 (for yt-dlp/play-dl if needed)
RUN apk add --no-cache ffmpeg python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]
