#!/bin/bash

set -e

WORKING_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="${WORKING_DIR}/update-prod.sh"
LOG_PATH="${WORKING_DIR}/logs/update-prod.log"
CRON_JOB="* * * * * cd ${WORKING_DIR} && ${SCRIPT_PATH} >> ${LOG_PATH} 2>&1"

echo "Installing update-prod cron job..."

# Ensure logs directory exists
mkdir -p "$(dirname "$LOG_PATH")"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -qF "$SCRIPT_PATH"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -vF "$SCRIPT_PATH" | crontab -
fi

# Add the cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job installed:"
echo "  Schedule: Every minute"
echo "  Script: ${SCRIPT_PATH}"
echo "  Log: ${LOG_PATH}"
echo ""
echo "View logs with: tail -f ${LOG_PATH}"
echo "Remove with: crontab -e (and delete the line)"
