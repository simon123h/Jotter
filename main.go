//go:build !wails

package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"jotter/backend/config"
	"jotter/backend/db"
	"jotter/backend/handlers"
)



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

func getFrontendDistDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	exeDir := filepath.Dir(exe)

	// Search locations relative to the executable:
	// 1. Sibling path: exeDir/frontend/dist
	path1 := filepath.Join(exeDir, "frontend", "dist")
	if fi, err := os.Stat(path1); err == nil && fi.IsDir() {
		return path1
	}

	// 2. Parent sibling path: parent(exeDir)/frontend/dist
	path2 := filepath.Join(filepath.Dir(exeDir), "frontend", "dist")
	if fi, err := os.Stat(path2); err == nil && fi.IsDir() {
		return path2
	}

	// 3. Parent parent sibling (common in dev mode): parent(parent(exeDir))/frontend/dist
	path3 := filepath.Join(filepath.Dir(filepath.Dir(exeDir)), "frontend", "dist")
	if fi, err := os.Stat(path3); err == nil && fi.IsDir() {
		return path3
	}

	// 4. Fallback search relative to CWD
	cwd, errCwd := os.Getwd()
	if errCwd == nil {
		path4 := filepath.Join(cwd, "frontend", "dist")
		if fi, err := os.Stat(path4); err == nil && fi.IsDir() {
			return path4
		}
		path5 := filepath.Join(filepath.Dir(cwd), "frontend", "dist")
		if fi, err := os.Stat(path5); err == nil && fi.IsDir() {
			return path5
		}
	}

	return ""
}

func main() {
	configFlag := flag.String("config", "", "Path to YAML/JSON configuration file")
	portFlag := flag.Int("port", 0, "Port to run the server on")
	hostFlag := flag.String("host", "", "Host address to bind to")
	dataDirFlag := flag.String("data-dir", "", "Directory to store markdown tasks")
	noBrowserFlag := flag.Bool("no-browser", false, "Do not open the web browser automatically")
	logLevelFlag := flag.String("log-level", "", "Set the logging level")

	flag.Parse()

	// Load configuration settings
	cfg := config.GetConfig(*configFlag)

	// Precedence: CLI Flag > Config File > Default value
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

	dataDir := config.GetDataDir(*configFlag, *dataDirFlag)
	logLevel := config.GetLogLevel(*configFlag)
	if *logLevelFlag != "" {
		logLevel = strings.ToUpper(*logLevelFlag)
	}

	// Expose data dir and log level as environment variables
	os.Setenv("JOTTER_DATA_DIR", dataDir)
	os.Setenv("JOTTER_LOG_LEVEL", logLevel)

	// Set up database path
	dbPath := config.GetDBPath(*configFlag, *dataDirFlag)

	// Bootstrap application settings and database
	bootstrap(dataDir, dbPath)
	defer db.CloseDB()

	fmt.Printf("Starting Jotter on http://%s:%d\n", host, port)

	// Start browser in a background thread after a short delay
	if !*noBrowserFlag {
		time.AfterFunc(1500*time.Millisecond, func() {
			url := fmt.Sprintf("http://%s:%d", host, port)
			if host == "127.0.0.1" || host == "0.0.0.0" {
				url = fmt.Sprintf("http://localhost:%d", port)
			}
			openBrowser(url)
		})
	}

	// Initialize router
	r := chi.NewRouter()

	// Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	if logLevel == "INFO" || logLevel == "DEBUG" {
		r.Use(middleware.Logger)
	}
	r.Use(middleware.Recoverer)
	r.Use(handlers.CORSMiddleware)

	// Register handlers
	handlers.RegisterProjectRoutes(r, dataDir)
	handlers.RegisterBucketRoutes(r, dataDir)
	handlers.RegisterTaskRoutes(r, dataDir)
	handlers.RegisterSystemRoutes(r, dataDir)

	// Static Files Routing
	distDir := getFrontendDistDir()
	if distDir != "" {
		log.Printf("Serving frontend static assets from: %s\n", distDir)
		fileServer := http.FileServer(http.Dir(distDir))

		// Serve static directory, and fallback unknown routes to index.html for frontend routing support
		r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			path := req.URL.Path
			// Check if file exists, if not serve index.html
			filePath := filepath.Join(distDir, path)
			if fi, err := os.Stat(filePath); err != nil || fi.IsDir() {
				http.ServeFile(w, req, filepath.Join(distDir, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, req)
		}))
	} else {
		log.Println("Warning: frontend/dist directory not found. Static files will not be served.")
		r.Get("/", func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`<h3>Jotter API is running</h3><p>Frontend assets are not compiled. Run <code>npm run build</code> in the frontend directory to serve them here.</p>`))
		})
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
