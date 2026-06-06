#!/bin/bash

# Jotter Linux Installer
# Installs the desktop application and server binary to the system.

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

mkdir -p "$BIN_DIR"
mkdir -p "$APPS_DIR"
mkdir -p "$ICONS_DIR"

echo "Installing $APP_NAME..."

# 1. Copy binaries
if [ -f "./$BINARY_NAME" ]; then
    cp "./$BINARY_NAME" "$BIN_DIR/"
elif [ -f "./build/bin/$BINARY_NAME" ]; then
    cp "./build/bin/$BINARY_NAME" "$BIN_DIR/"
fi
chmod +x "$BIN_DIR/$BINARY_NAME"

if [ -f "./$SERVER_NAME" ]; then
    cp "./$SERVER_NAME" "$BIN_DIR/"
elif [ -f "./build/bin/$SERVER_NAME" ]; then
    cp "./build/bin/$SERVER_NAME" "$BIN_DIR/"
fi
chmod +x "$BIN_DIR/$SERVER_NAME"

# 2. Copy icon
if [ -f "./$ICON_NAME" ]; then
    cp "./$ICON_NAME" "$ICONS_DIR/"
elif [ -f "./build/appicon.png" ]; then
    cp "./build/appicon.png" "$ICONS_DIR/$ICON_NAME"
elif [ -f "./docs/assets/icon.png" ]; then
    cp "./docs/assets/icon.png" "$ICONS_DIR/$ICON_NAME"
fi

# 3. Create .desktop file
cat <<EOF > "$APPS_DIR/jotter.desktop"
[Desktop Entry]
Name=$APP_NAME
Comment=Local-first Markdown Kanban Board
Exec=$BIN_DIR/$BINARY_NAME
Icon=$ICON_NAME
Terminal=false
Type=Application
Categories=Office;Utility;ProjectManagement;
Keywords=kanban;markdown;todo;task;
EOF

echo "$APP_NAME has been installed successfully!"
echo "You can now find it in your application menu."
echo "Binaries installed to: $BIN_DIR"
