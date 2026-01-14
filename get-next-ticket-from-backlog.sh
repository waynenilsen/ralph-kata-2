#!/bin/bash

# Get the next N tickets from the Backlog column in project #4
# Usage: ./get-next-ticket-from-backlog.sh <number-of-tickets>

NUM_TICKETS=${1:-1}

gh project item-list 4 --owner @me --format json --limit 100 | \
  jq -r --argjson n "$NUM_TICKETS" '[.items[] | select(.status == "Backlog")] | .[0:$n] | .[] | "#\(.content.number) \(.content.title)"'
