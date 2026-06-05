//go:build !wails && !bindings

package main

import "jotter/backend/internal/app"

func main() {
	cfg := app.LoadConfig()
	app.RunServer(cfg, Assets)
}
