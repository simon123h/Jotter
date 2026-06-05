//go:build wails

package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"

	"jotter/backend/config"
	"jotter/backend/db"
	"jotter/backend/handlers"
)

func getWailsLogLevel(level string) logger.LogLevel {
	switch strings.ToUpper(level) {
	case "DEBUG":
		return logger.DEBUG
	case "INFO":
		return logger.INFO
	case "WARNING", "WARN":
		return logger.WARNING
	case "ERROR", "ERR":
		return logger.ERROR
	default:
		return logger.INFO
	}
}

//go:embed all:frontend/dist
var assets embed.FS

//go:embed docs/assets/icon.png
var icon []byte

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func main() {
	// Load config
	cfg := config.GetConfig("")
	port := cfg.Port
	if port == 0 {
		port = 8000
	}
	host := cfg.Host
	if host == "" {
		host = "127.0.0.1"
	}
	dataDir := config.GetDataDir("", "")
	dbPath := config.GetDBPath("", "")

	// Bootstrap application settings and database
	bootstrap(dataDir, dbPath)
	defer db.CloseDB()

	// Setup Chi Router to serve as local Wails AssetServer Handler (no TCP listening port)
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	logLevel := config.GetLogLevel("")
	if logLevel == "INFO" || logLevel == "DEBUG" {
		r.Use(middleware.Logger)
	}

	r.Use(middleware.Recoverer)
	r.Use(handlers.CORSMiddleware)

	// Register REST routes
	handlers.RegisterProjectRoutes(r, dataDir)
	handlers.RegisterBucketRoutes(r, dataDir)
	handlers.RegisterTaskRoutes(r, dataDir)
	handlers.RegisterSystemRoutes(r, dataDir)

	// Get sub-filesystem pointing to frontend/dist to remove folder prefix from embedded path roots
	assetsSub, errFs := fs.Sub(assets, "frontend/dist")
	if errFs != nil {
		log.Fatalf("Failed to create assets sub-filesystem: %v", errFs)
	}

	// Run Wails application
	app := NewApp()
	err := wails.Run(&options.App{
		Title:  "Jotter",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets:  assetsSub,
			Handler: r,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 41, B: 59, A: 1}, // Slate dark color
		LogLevel:         getWailsLogLevel(logLevel),
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon: icon,
		},
	})

	if err != nil {
		log.Fatalf("Wails launch failed: %v", err)
	}
}
