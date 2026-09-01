# ── Build stage ──
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Create React App inlines env vars at build time, so these must be provided
# as build args rather than at runtime.
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

RUN npm run build

# ── Serve stage ──
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# Single-page app: unknown paths must still return index.html so client-side
# routes like /chat/<roomId> work on a hard refresh.
RUN printf 'server {\n\
  listen 3000;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / { try_files $uri $uri/ /index.html; }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
