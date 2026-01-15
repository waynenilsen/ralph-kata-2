#!/bin/bash

set -e

SERVICE_NAME="ralph-kata-2"

echo "Restarting ${SERVICE_NAME} service..."
systemctl --user restart "$SERVICE_NAME"

echo "Service restarted."
systemctl --user status "$SERVICE_NAME" --no-pager
