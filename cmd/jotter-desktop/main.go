//go:build wails

package main

import "jotter/backend/internal/app"

func main() {
	if app.IsWailsProbing() {
		app.RunWailsProbing()
		return
	}

	cfg := app.LoadConfig()
	app.RunDesktop(cfg)
}
