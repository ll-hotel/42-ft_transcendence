set -e
tsc --watch &
exec nginx -g "daemon off;"
