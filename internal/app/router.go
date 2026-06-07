package app

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/common"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/settings"
	"jotter/backend/internal/features/system"
	"jotter/backend/internal/features/task"
)

func BuildRouter(logLevel, dataDir string, serveStatic bool, assets embed.FS) *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	// Only enable request logging if log level is INFO or DEBUG
	logLvl := strings.ToUpper(logLevel)
	if logLvl == "INFO" || logLvl == "DEBUG" {
		r.Use(middleware.Logger)
	}

	r.Use(middleware.Recoverer)
	r.Use(common.CORSMiddleware)

	r.Route("/api", func(r chi.Router) {
		project.RegisterRoutes(r, dataDir, bucket.DefaultBuckets, bucket.SyncBucketsFile)
		bucket.RegisterRoutes(r, dataDir)
		task.RegisterRoutes(r, dataDir)
		system.RegisterRoutes(r, dataDir)
		settings.RegisterRoutes(r, dataDir)
	})

	if serveStatic {
		assetsSub, errFs := fs.Sub(assets, "frontend/dist")
		var useEmbedded bool
		if errFs == nil {
			if data, err := fs.ReadFile(assetsSub, "index.html"); err == nil && len(data) > 30 {
				useEmbedded = true
			}
		}

		if useEmbedded {
			fileServer := http.FileServer(http.FS(assetsSub))
			r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				path := req.URL.Path
				filePath := strings.TrimPrefix(path, "/")
				if filePath == "" {
					filePath = "index.html"
				}
				f, err := assetsSub.Open(filePath)
				if err != nil {
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
		} else {
			distDir := getFrontendDistDir()
			if distDir != "" {
				fileServer := http.FileServer(http.Dir(distDir))
				r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					path := req.URL.Path
					filePath := filepath.Join(distDir, path)
					if fi, err := os.Stat(filePath); err != nil || fi.IsDir() {
						http.ServeFile(w, req, filepath.Join(distDir, "index.html"))
						return
					}
					fileServer.ServeHTTP(w, req)
				}))
			}
		}
	}
	return r
}

func getFrontendDistDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	exeDir := filepath.Dir(exe)
	cwd, _ := os.Getwd()

	searchPaths := []string{
		filepath.Join(exeDir, "frontend", "dist"),
		filepath.Join(filepath.Dir(exeDir), "frontend", "dist"),
		filepath.Join(filepath.Dir(filepath.Dir(exeDir)), "frontend", "dist"),
		filepath.Join(cwd, "frontend", "dist"),
		filepath.Join(filepath.Dir(cwd), "frontend", "dist"),
	}

	for _, path := range searchPaths {
		if fi, err := os.Stat(path); err == nil && fi.IsDir() {
			return path
		}
	}
	return ""
}
