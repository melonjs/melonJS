docker build .. -f Dockerfile -t melonjs:latest --no-cache 
docker run --name melonjs-doc melonjs:latest npm run doc-prod
docker cp melonjs-doc:/docs/ ../
docker rm melonjs-doc