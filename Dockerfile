FROM alpine:3.9

COPY . /opt/strashbot

RUN apk --no-cache add npm nodejs

WORKDIR /opt/strashbot

CMD node bot.js
