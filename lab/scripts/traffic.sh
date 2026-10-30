#!/bin/sh
# Real requests to web-01's nginx, from fixed test addresses on the loopback (127.0.0.0/8 is all
# local), so the access log has clients and status codes to read in course 4. Fixed counts and order:
# the log's lines are the same on every replay apart from their timestamps.
#   ip count path agent
while read -r ip n path agent; do
  i=0
  while [ "$i" -lt "$n" ]; do
    curl -s -o /dev/null --interface "$ip" -A "$agent" "http://localhost$path"
    i=$((i + 1))
  done
done <<'LIST'
127.0.0.10 40 / Mozilla/5.0
127.0.0.11 25 / Mozilla/5.0
127.0.0.12 12 /index.nginx-debian.html Mozilla/5.0
127.0.0.13 8 / curl/8.14.1
127.0.0.66 9 /wp-login.php python-requests/2.32
127.0.0.66 6 /.env python-requests/2.32
127.0.0.67 4 /admin python-requests/2.32
127.0.0.10 3 /favicon.ico Mozilla/5.0
LIST
