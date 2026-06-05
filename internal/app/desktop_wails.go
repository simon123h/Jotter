//go:build wails

package app

import (
	"context"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"

	"jotter/backend"
)

type DesktopApp struct {
	ctx context.Context
	cfg *AppConfig
}

func NewDesktopApp(cfg *AppConfig) *DesktopApp {
	return &DesktopApp{cfg: cfg}
}

func (a *DesktopApp) GetAPIUrl() string {
	return a.cfg.APIAddr
}

func (a *DesktopApp) startup(ctx context.Context) {
	a.ctx = ctx
	Bootstrap(a.cfg.DataDir, a.cfg.DBPath)

	// Start background HTTP server
	r := BuildRouter(a.cfg.LogLevel, a.cfg.DataDir, true)
	go func() {
		log.Printf("Starting background REST/Static server on %s", a.cfg.Addr)
		if err := http.ListenAndServe(a.cfg.Addr, r); err != nil {
			log.Printf("Background server error: %v", err)
		}
	}()
}

func IsWailsProbing() bool {
	if os.Getenv("WAILS_GENERATE") == "true" {
		return true
	}
	for _, arg := range os.Args {
		if strings.Contains(arg, "generate") || arg == "-v" || arg == "-h" || arg == "--help" {
			return true
		}
	}
	return false
}

func RunWailsProbing() {
	_ = wails.Run(&options.App{
		Bind: []interface{}{&DesktopApp{cfg: &AppConfig{}}},
	})
}

func RunDesktop(cfg *AppConfig) {
	// Window Mode (Wails)
	apiRouter := BuildRouter(cfg.LogLevel, cfg.DataDir, false) // API only for handler

	assetsSub, _ := fs.Sub(backend.Assets, "frontend/dist")

	app := NewDesktopApp(cfg)

	var wailsLogLevel logger.LogLevel
	switch strings.ToUpper(cfg.LogLevel) {
	case "DEBUG":
		wailsLogLevel = logger.DEBUG
	case "INFO":
		wailsLogLevel = logger.INFO
	case "WARNING", "WARN":
		wailsLogLevel = logger.WARNING
	case "ERROR", "ERR":
		wailsLogLevel = logger.ERROR
	default:
		wailsLogLevel = logger.INFO
	}

	err := wails.Run(&options.App{
		Title:  "Jotter",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets:  assetsSub,
			Handler: apiRouter,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 41, B: 59, A: 1},
		LogLevel:         wailsLogLevel,
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon: backend.Icon,
		},
	})

	if err != nil {
		log.Fatalf("Wails launch failed: %v", err)
	}
}
