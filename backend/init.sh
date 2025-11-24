#!/bin/env sh
set -e

tsc
tsc --watch &

exec nodemon dist/index.js --watch dist
