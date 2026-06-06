package app

import (
	"fmt"
	"log"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/system"
)

var Version = "[dev mode]"

const asciiLogo = `
   ___       _   _            
  |_  |     | | | |           
    | | ___ | |_| |_ ___ _ __ 
    | |/ _ \| __| __/ _ \ '__|
/\__/ / (_) | |_| ||  __/ |   
\____/ \___/ \__|\__\___|_|   
                              
`

// bootstrap initializes the database schema, runs the file-to-db synchronization,
// and prints the startup ASCII banner.
func Bootstrap(dataDir string, dbPath string) {
	// Print ASCII Art logo and basic startup info
	fmt.Print(asciiLogo)
	fmt.Printf("Jotter - Local-first Markdown Kanban Board (Version: %s)\n", Version)
	fmt.Println("==========================================")
	fmt.Printf("Using database file: %s\n", dbPath)
	fmt.Printf("Using tasks markdown directory: %s\n", dataDir)

	// Initialize SQLite Database
	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}

	// Ensure projects.json exists
	_, _ = project.LoadProjectsFile(dataDir)

	// Sync database with markdown files automatically on startup
	if _, err := system.SyncDBWithFiles(dataDir); err != nil {
		log.Fatalf("Initial sync failed: %v", err)
	}
}
