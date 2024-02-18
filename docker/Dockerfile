FROM node:lts-buster

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /
COPY . /
RUN rm -rf node_modules
RUN npm install
