#!/bin/bash

set -e

SERVICE_NAME="ralph-kata-2"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/${SERVICE_NAME}.service"
WORKING_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
DB_PATH="${WORKING_DIR}/data/prod.db"

# Detect node path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "Error: node not found in PATH"
    exit 1
fi

echo "Creating/updating user systemd service for ${SERVICE_NAME}..."
echo "Working directory: ${WORKING_DIR}"
echo "Node path: ${NODE_PATH}"
echo "Port: ${PORT}"
echo "Database: ${DB_PATH}"

# Ensure directories exist
mkdir -p "$SERVICE_DIR"
mkdir -p "$(dirname "$DB_PATH")"

# Create the systemd service file
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Ralph Kata 2 Production Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${WORKING_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=DATABASE_URL=file:${DB_PATH}
ExecStart=${NODE_PATH} ${WORKING_DIR}/.next/standalone/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=default.target
EOF

echo "Service file created at ${SERVICE_FILE}"

# Reload systemd daemon
systemctl --user daemon-reload

# Enable and restart the service
systemctl --user enable "$SERVICE_NAME"
systemctl --user restart "$SERVICE_NAME"

echo "Service ${SERVICE_NAME} has been created/updated and started."
echo "Check status with: systemctl --user status ${SERVICE_NAME}"
echo "View logs with: journalctl --user -u ${SERVICE_NAME} -f"
