package backend

import "embed"

// Assets embeds the frontend build artifacts
//
//go:embed all:frontend/dist
var Assets embed.FS

// Icon embeds the application icon
//
//go:embed docs/assets/icon.png
var Icon []byte
