#!/usr/bin/env bash
#
# inner-loop.sh - Execute claude command with proper arguments
#
# Called by loop.sh via script(1) to provide a pseudo-TTY.
# Separated to avoid quoting issues with nested shell escaping.
#

set -euo pipefail

# Ensure PATH includes user binaries (for bun, claude, etc.)
# This is needed for systemd services where .bashrc isn't fully sourced
export PATH="$HOME/.local/bin:$PATH"

# Load NVM for node (needed by Playwright)
# shellcheck source=/dev/null
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"

claude -p "@prompts/promptgrams/ralph.md" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose
