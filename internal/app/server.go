package app

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"time"

	"jotter/backend/internal/db"
)

func RunServer(cfg *AppConfig, assets embed.FS) {
	Bootstrap(cfg.DataDir, cfg.DBPath)
	defer db.CloseDB()

	r := BuildRouter(cfg.LogLevel, cfg.DataDir, true, assets)

	fmt.Printf("Starting Jotter Server on %s\n", cfg.APIAddr)

	if cfg.AutoOpenBrowser {
		time.AfterFunc(1500*time.Millisecond, func() {
			log.Printf("Opening browser at %s", cfg.APIAddr)
			OpenBrowser(cfg.APIAddr)
		})
	}

	if err := http.ListenAndServe(cfg.Addr, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
