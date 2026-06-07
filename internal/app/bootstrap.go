package app

import (
	"fmt"
	"log"
	"os"

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

// rebuildDB closes the DB connection, deletes the old DB cache files, and re-initializes a clean DB schema.
func rebuildDB(dbPath string) error {
	db.CloseDB()

	// Remove transient SQLite db files
	_ = os.Remove(dbPath)
	_ = os.Remove(dbPath + "-wal")
	_ = os.Remove(dbPath + "-shm")

	if err := db.InitDB(dbPath); err != nil {
		return fmt.Errorf("failed to initialize clean database: %w", err)
	}
	return nil
}

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
		log.Printf("Database initialization failed: %v. Attempting automatic cache rebuild...", err)
		if errRebuild := rebuildDB(dbPath); errRebuild != nil {
			log.Fatalf("Fatal: Database rebuild failed: %v", errRebuild)
		}
	}

	// Ensure projects.json exists
	_, _ = project.LoadProjectsFile(dataDir)

	// Sync database with markdown files automatically on startup
	if _, err := system.SyncDBWithFiles(dataDir); err != nil {
		log.Printf("Initial sync failed (likely due to schema mismatch or database corruption): %v. Rebuilding cache database...", err)
		if errRebuild := rebuildDB(dbPath); errRebuild != nil {
			log.Fatalf("Fatal: Database rebuild failed: %v", errRebuild)
		}

		// Re-attempt synchronization after rebuilding database with clean schema
		if _, errSync := system.SyncDBWithFiles(dataDir); errSync != nil {
			log.Fatalf("Fatal: Initial sync failed after database rebuild: %v", errSync)
		}
	}
}
