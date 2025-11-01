#!/bin/env sh
set -e
tsc --watch &
npx @tailwindcss/cli -i src/input.css -o static/tailwind.css --watch &
exec nginx -g "daemon off;"
