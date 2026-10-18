FROM php:8.3-cli-alpine

RUN apk add --no-cache libcurl \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS curl-dev \
    && docker-php-ext-install curl \
    && apk del .build-deps

WORKDIR /app
COPY . .

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t /app"]
