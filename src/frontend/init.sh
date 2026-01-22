set -e
tsc --watch &
npx tailwindcss -i src/input.css -o static/tailwind.css --watch=always &
exec nginx -g "daemon off;"
