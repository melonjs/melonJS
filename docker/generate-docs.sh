#!/bin/bash
docker build . -f docker/Dockerfile -t melonjs:latest --no-cache && \
docker run -it --rm --name melonjs-doc -d melonjs:latest  /bin/bash && \
docker exec melonjs-doc npm install && \
docker exec melonjs-doc npm run doc-prod && \
docker cp melonjs-doc:/docs/ .
docker stop melonjs-doc
