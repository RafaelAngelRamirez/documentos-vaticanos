FROM nginx
WORKDIR /usr/share/nginx/html
RUN rm index.html
COPY dist/documentos-vaticanos .
RUN ls -las /usr/share/nginx/html
# RUN chmod -R 755 /usr/share/nginx/html


# Not /etc/nginx/nginx.conf
# COPY ./nginx.conf /etc/nginx/conf.d/default.conf
