#!/bin/bash
set -ev

if [ "${TRAVIS_NODE_VERSION}" = "6" ] ; then
    artifacts upload \
        --bucket melonjs-builds \
        --s3-region us-east-1 \
        --permissions public-read \
        --target-paths artifacts/${TRAVIS_BRANCH}/${TRAVIS_BUILD_NUMBER} \
        build/melonJS.js
fi
