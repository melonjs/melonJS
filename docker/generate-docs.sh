#!/bin/bash
# check for the correct docker
if [ -z "$(docker info | grep cgroup)" ]
then
  echo "Please install Docker https://www.docker.com/"
  exit -1
fi

docker build -f docker/Dockerfile -t melonjs:latest --no-cache . && \
docker run --name melonjs-doc melonjs:latest npm run doc-prod && \
docker cp melonjs-doc:/docs/ .
docker stop melonjs-doc
