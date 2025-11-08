#!/bin/env sh
set -e

tsc
tsc --watch &

exec node dist/index.js --watch
