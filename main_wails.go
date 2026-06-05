//go:build wails

package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

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

func openBrowser(url string) {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default: // Linux
		cmd = "xdg-open"
		args = []string{url}
	}

	_ = exec.Command(cmd, args...).Start()
}

//go:embed all:frontend/dist
var assets embed.FS

//go:embed docs/assets/icon.png
var icon []byte

// App struct
type App struct {
	ctx     context.Context
	apiUrl  string
}

// NewApp creates a new App struct
func NewApp() *App {
	return &App{}
}

func (a *App) GetAPIUrl() string {
	return a.apiUrl
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}


func main() {
	configFlag := flag.String("config", "", "Path to YAML/JSON configuration file")
	portFlag := flag.Int("port", 0, "Port to run the server on")
	hostFlag := flag.String("host", "", "Host address to bind to")
	dataDirFlag := flag.String("data-dir", "", "Directory to store markdown tasks")
	launchFlag := flag.String("launch", "", "Startup mode: 'window' (default) or 'browser'")
	logLevelFlag := flag.String("log-level", "", "Set the logging level")

	flag.Parse()

	// Load config
	cfg := config.GetConfig(*configFlag)
	
	port := *portFlag
	if port == 0 {
		port = cfg.Port
	}
	if port == 0 {
		port = 8000
	}

	host := *hostFlag
	if host == "" {
		host = cfg.Host
	}
	if host == "" {
		host = "127.0.0.1"
	}

	launch := *launchFlag
	if launch == "" {
		launch = cfg.Launch
	}
	if launch != "browser" {
		launch = "window"
	}

	dataDir := config.GetDataDir(*configFlag, *dataDirFlag)
	dbPath := config.GetDBPath(*configFlag, *dataDirFlag)
	logLevel := config.GetLogLevel(*configFlag)
	if *logLevelFlag != "" {
		logLevel = strings.ToUpper(*logLevelFlag)
	}

	// Expose data dir and log level as environment variables
	os.Setenv("JOTTER_DATA_DIR", dataDir)
	os.Setenv("JOTTER_LOG_LEVEL", logLevel)

	// Bootstrap application settings and database
	bootstrap(dataDir, dbPath)
	defer db.CloseDB()

	// Setup Chi Router
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

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

	// Get sub-filesystem pointing to frontend/dist
	assetsSub, errFs := fs.Sub(assets, "frontend/dist")
	if errFs != nil {
		log.Fatalf("Failed to create assets sub-filesystem: %v", errFs)
	}

	// Static Files Routing (for external browser access)
	fileServer := http.FileServer(http.FS(assetsSub))
	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		path := req.URL.Path
		filePath := strings.TrimPrefix(path, "/")
		if filePath == "" {
			filePath = "index.html"
		}
		f, err := assetsSub.Open(filePath)
		if err != nil {
			// Fallback to index.html for frontend routing
			indexData, errIndex := fs.ReadFile(assetsSub, "index.html")
			if errIndex == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(indexData)
				return
			}
			http.NotFound(w, req)
			return
		}
		f.Close()
		fileServer.ServeHTTP(w, req)
	}))

	// Start a real background HTTP server so browsers can connect to localhost:port
	addr := fmt.Sprintf("%s:%d", host, port)
	
	apiAddr := fmt.Sprintf("http://%s:%d", host, port)
	if host == "0.0.0.0" {
		apiAddr = fmt.Sprintf("http://localhost:%d", port)
	}

	// Automatically open browser if configured
	if launch == "browser" {
		time.AfterFunc(1000*time.Millisecond, func() {
			log.Printf("Opening browser at %s", apiAddr)
			openBrowser(apiAddr)
		})

		log.Printf("Starting in browser mode on %s", addr)
		if err := http.ListenAndServe(addr, r); err != nil {
			log.Fatalf("Server error: %v", err)
		}
		return
	}

	// Default: Normal Wails mode (window)
	go func() {
		log.Printf("Starting background REST/Static server on %s", addr)
		if err := http.ListenAndServe(addr, r); err != nil {
			log.Printf("Background server error: %v", err)
		}
	}()

	// Run Wails application
	app := NewApp()
	app.apiUrl = apiAddr
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


