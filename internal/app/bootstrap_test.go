package app

import (
	"jotter/backend/internal/db"
	"os"
	"path/filepath"
	"testing"
)

func TestBootstrap(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "bootstrap-test-*")
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	dataDir := filepath.Join(tempDir, "tasks")
	os.MkdirAll(dataDir, 0755)

	t.Run("Full Bootstrap", func(t *testing.T) {
		Bootstrap("", dataDir, dbPath)
		defer db.CloseDB()

		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			t.Error("Database file was not created")
		}

		if _, err := os.Stat(filepath.Join(dataDir, "projects.json")); os.IsNotExist(err) {
			t.Error("Default projects.json was not created")
		}
	})
}
