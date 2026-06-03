# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

# Replace the default site with our reverse-proxy config.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
