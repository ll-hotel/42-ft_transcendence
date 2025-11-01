#!/bin/env sh
set -e
tsc --watch &
exec nginx -g "daemon off;"
