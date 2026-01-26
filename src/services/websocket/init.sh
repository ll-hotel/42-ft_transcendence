#!/bin/env sh
set -e

tsc
tsc --watch &

exec nodemon dist/main.js --watch dist
