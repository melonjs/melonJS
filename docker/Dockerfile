FROM node:lts-buster

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /

RUN apt update && \
  apt install -y --no-install-recommends \
  openssh-client \
  ca-certificates \
  rsync \
  curl \
  wget \
  gnupg \
  git

COPY . /
RUN npm install
