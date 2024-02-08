FROM ubuntu:22.04

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

RUN apt remove --purge -y nodejs npm
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_21.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
RUN apt update -qq && \
  apt install -y --no-install-recommends \
  nodejs

RUN git clone https://github.com/melonjs/melonJS.git /melonjs
RUN rsync -a /melonjs/ /
RUN npm install
