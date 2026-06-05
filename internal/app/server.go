package app

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"jotter/backend/internal/db"
)

func RunServer(cfg *AppConfig) {
	Bootstrap(cfg.DataDir, cfg.DBPath)
	defer db.CloseDB()

	r := BuildRouter(cfg.LogLevel, cfg.DataDir, true)

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
