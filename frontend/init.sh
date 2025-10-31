#!/bin/sh

set -e

tsc --watch &
nginx -g "daemon off;"
