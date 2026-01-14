#!/usr/bin/env bash
#
# inner-loop.sh - Execute claude command with proper arguments
#
# Called by loop.sh via script(1) to provide a pseudo-TTY.
# Separated to avoid quoting issues with nested shell escaping.
#

set -euo pipefail

claude -p "@prompts/promptgrams/ralph.md" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose
