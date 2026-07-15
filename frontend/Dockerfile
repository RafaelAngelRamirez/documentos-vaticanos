FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -f index.html
# Production Angular tree (must already include downloads/ when CI packaged)
COPY dist/documentos-vaticanos/ .
# SPA + /downloads static installers
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN ls -las /usr/share/nginx/html && \
    (test -f /usr/share/nginx/html/index.html) && \
    (ls -la /usr/share/nginx/html/downloads 2>/dev/null || echo "WARN: no downloads/ in image context")
