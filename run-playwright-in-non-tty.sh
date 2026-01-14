#!/usr/bin/env bash
#
# run-playwright-in-non-tty.sh - Run Playwright tests in non-TTY environments
#
# This script ensures Playwright runs correctly in non-TTY environments (CI, pipes, etc.)
# It verifies the non-TTY transition was successful before running tests.
#
# Usage:
#   ./run-playwright-in-non-tty.sh                    # Run all e2e tests
#   ./run-playwright-in-non-tty.sh example.e2e.ts    # Run specific test file
#   ./run-playwright-in-non-tty.sh --grep "homepage" # Pass any playwright args
#

set -euo pipefail

# Colors (only used if stdout is a terminal, which it shouldn't be in non-TTY)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

log() {
  echo "[playwright-runner] $1"
}

log_success() {
  echo -e "${GREEN}[✓]${RESET} $1"
}

log_error() {
  echo -e "${RED}[✗]${RESET} $1"
}

log_warning() {
  echo -e "${YELLOW}[!]${RESET} $1"
}

# Test 1: Verify we're in a non-TTY environment
verify_non_tty() {
  log "Verifying non-TTY environment..."

  # Check if stdin is a TTY
  if [ -t 0 ]; then
    log_warning "stdin IS a TTY (fd 0)"
    STDIN_TTY=1
  else
    log_success "stdin is NOT a TTY (fd 0)"
    STDIN_TTY=0
  fi

  # Check if stdout is a TTY
  if [ -t 1 ]; then
    log_warning "stdout IS a TTY (fd 1)"
    STDOUT_TTY=1
  else
    log_success "stdout is NOT a TTY (fd 1)"
    STDOUT_TTY=0
  fi

  # Check if stderr is a TTY
  if [ -t 2 ]; then
    log_warning "stderr IS a TTY (fd 2)"
    STDERR_TTY=1
  else
    log_success "stderr is NOT a TTY (fd 2)"
    STDERR_TTY=0
  fi

  # For non-TTY mode, at least stdin should not be a TTY
  # (stdout/stderr might still be TTYs in some CI environments)
  if [ "$STDIN_TTY" -eq 1 ]; then
    log_error "ERROR: This script should be run in a non-TTY environment!"
    log_error "stdin is still a TTY. To test non-TTY behavior, run with:"
    log_error "  echo '' | ./run-playwright-in-non-tty.sh"
    log_error "  ./run-playwright-in-non-tty.sh < /dev/null"
    log_error "  CI=1 ./run-playwright-in-non-tty.sh"
    exit 1
  fi

  log_success "Non-TTY environment verified"
  echo ""
}

# Test 2: Verify required environment variables
verify_env_vars() {
  log "Setting up Playwright environment variables..."

  # Force non-TTY mode for Playwright
  export PLAYWRIGHT_FORCE_TTY=0
  export PLAYWRIGHT_HTML_OPEN=never
  export CI=${CI:-1}

  # Disable colors (NO_COLOR is the standard, FORCE_COLOR conflicts with it)
  export NO_COLOR=1
  unset FORCE_COLOR 2>/dev/null || true

  log_success "PLAYWRIGHT_FORCE_TTY=0"
  log_success "PLAYWRIGHT_HTML_OPEN=never"
  log_success "CI=$CI"
  log_success "NO_COLOR=1"
  echo ""
}

# Run Playwright tests
run_playwright() {
  log "Running Playwright tests..."
  echo ""

  # Use node directly to avoid Bun's TTY issues
  # Load environment from .env via dotenv-cli
  if [ -f "node_modules/.bin/dotenv" ]; then
    node node_modules/.bin/dotenv -- node node_modules/.bin/playwright test "$@"
  else
    node node_modules/.bin/playwright test "$@"
  fi
}

main() {
  echo "========================================"
  echo "Playwright Non-TTY Runner"
  echo "========================================"
  echo ""

  verify_non_tty
  verify_env_vars
  run_playwright "$@"
}

main "$@"
