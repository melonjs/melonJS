#!/bin/bash
set -ev

if [ "${TRAVIS_NODE_VERSION}" = "0.10" ] ; then
    travis-artifacts upload \
        --path build/melonJS.js \
        --target-path artifacts/${TRAVIS_BRANCH}/${TRAVIS_BUILD_NUMBER}
fi
