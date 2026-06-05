package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInitDB(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "db-test-*")
	defer os.RemoveAll(tempDir)
	dbPath := filepath.Join(tempDir, "test.db")

	t.Run("Initialize and Schema", func(t *testing.T) {
		err := InitDB(dbPath)
		if err != nil {
			t.Fatalf("Failed to init DB: %v", err)
		}
		defer CloseDB()

		if DB == nil {
			t.Fatal("DB instance is nil after InitDB")
		}

		// Verify tables exist
		tables := []string{"projects", "buckets", "tasks"}
		for _, table := range tables {
			var name string
			err := DB.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
			if err != nil {
				t.Errorf("Table %s not found in schema: %v", table, err)
			}
		}
	})

	t.Run("Re-initialize (Already Exists)", func(t *testing.T) {
		err := InitDB(dbPath)
		if err != nil {
			t.Fatalf("Failed to re-init DB: %v", err)
		}
		CloseDB()
	})
}
