package app

import (
	"embed"
	"fmt"
	"log"
	"net/http"

	"jotter/backend/internal/db"
)

func RunServer(cfg *AppConfig, assets embed.FS) {
	Bootstrap(cfg.ConfigPath, cfg.DataDir, cfg.DBPath)
	defer db.CloseDB()

	r := BuildRouter(cfg.LogLevel, cfg.DataDir, true, assets)

	fmt.Printf("Starting Jotter Server on %s\n", cfg.APIAddr)

	if err := http.ListenAndServe(cfg.Addr, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
