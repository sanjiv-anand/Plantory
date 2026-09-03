FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_MEDIA_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MEDIA_URL=${VITE_MEDIA_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
