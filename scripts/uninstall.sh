#!/bin/bash

# Jotter Linux Uninstaller

set -e

APP_NAME="Jotter"
BINARY_NAME="jotter-desktop"
SERVER_NAME="jotter-server"
ICON_NAME="jotter.png"

# Determine install paths
if [ "$EUID" -ne 0 ]; then
    # User install
    BIN_DIR="$HOME/.local/bin"
    APPS_DIR="$HOME/.local/share/applications"
    ICONS_DIR="$HOME/.local/share/icons"
else
    # Root install
    BIN_DIR="/usr/local/bin"
    APPS_DIR="/usr/share/applications"
    ICONS_DIR="/usr/share/icons/hicolor/scalable/apps"
fi

echo "Uninstalling $APP_NAME..."

rm -f "$BIN_DIR/$BINARY_NAME"
rm -f "$BIN_DIR/$SERVER_NAME"
rm -f "$ICONS_DIR/$ICON_NAME"
rm -f "$APPS_DIR/jotter.desktop"

echo "$APP_NAME has been removed from your system."
