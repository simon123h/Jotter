//go:build wails || bindings

package app

import (
	"context"
	"embed"
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
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"jotter/backend/internal/features/settings"
)

type DesktopApp struct {
	ctx context.Context
	cfg *AppConfig
}

func NewDesktopApp(cfg *AppConfig) *DesktopApp {
	return &DesktopApp{cfg: cfg}
}

func (a *DesktopApp) startup(ctx context.Context, assets embed.FS) {
	a.ctx = ctx

	// Start background HTTP server
	r := BuildRouter(a.cfg.LogLevel, a.cfg.DataDir, true, assets)
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
		if strings.Contains(arg, "generate") ||
			strings.HasPrefix(arg, "-ts") ||
			arg == "-v" || arg == "-h" || arg == "--help" {
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

func RunDesktop(cfg *AppConfig, assets embed.FS, icon []byte) {
	Bootstrap(cfg.ConfigPath, cfg.DataDir, cfg.DBPath)

	// Load settings for window state
	width := 1024
	height := 768
	var startState options.WindowStartState = options.Maximised

	appSettings, errSettings := settings.LoadSettings(cfg.DataDir)
	if errSettings == nil {
		if appSettings.WindowWidth > 0 {
			width = appSettings.WindowWidth
		}
		if appSettings.WindowHeight > 0 {
			height = appSettings.WindowHeight
		}
		if !appSettings.WindowMaximized {
			startState = options.Normal
		}
	}

	// Window Mode (Wails)
	apiRouter := BuildRouter(cfg.LogLevel, cfg.DataDir, false, assets) // API only for handler

	assetsSub, _ := fs.Sub(assets, "frontend/dist")

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

	wailsOptions := &options.App{
		Title:            "Jotter",
		Width:            width,
		Height:           height,
		WindowStartState: startState,
		StartHidden:      true,
		AssetServer: &assetserver.Options{
			Assets:  assetsSub,
			Handler: apiRouter,
		},
		BackgroundColour: &options.RGBA{R: 30, G: 41, B: 59, A: 1},
		LogLevel:         wailsLogLevel,
		OnStartup: func(ctx context.Context) {
			app.startup(ctx, assets)
		},
		OnDomReady: func(ctx context.Context) {
			if errSettings == nil && (appSettings.WindowX > 0 || appSettings.WindowY > 0) {
				runtime.WindowSetPosition(ctx, appSettings.WindowX, appSettings.WindowY)
			}
			runtime.WindowShow(ctx)
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			if s, err := settings.LoadSettings(cfg.DataDir); err == nil {
				isMaximized := runtime.WindowIsMaximised(ctx)
				s.WindowMaximized = isMaximized
				if !isMaximized {
					w, h := runtime.WindowGetSize(ctx)
					s.WindowWidth = w
					s.WindowHeight = h
					px, py := runtime.WindowGetPosition(ctx)
					s.WindowX = px
					s.WindowY = py
				}
				_ = settings.SaveSettings(cfg.DataDir, s)
			}
			return false
		},
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon: icon,
		},
	}

	err := wails.Run(wailsOptions)

	if err != nil {
		log.Fatalf("Wails launch failed: %v", err)
	}
}
