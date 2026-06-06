package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	// Ensure parent directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// SQLite is file-based, limit connection pool to 1 to prevent "database is locked" errors
	DB.SetMaxOpenConns(1)

	// Enable WAL (Write-Ahead Logging) and foreign key constraints
	if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		return err
	}
	if _, err := DB.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		return err
	}

	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		created_at TEXT NOT NULL,
		done_clean_period INTEGER DEFAULT NULL,
		git_remote TEXT DEFAULT NULL
	);

	CREATE TABLE IF NOT EXISTS buckets (
		project_id TEXT NOT NULL,
		name TEXT NOT NULL,
		title TEXT NOT NULL,
		subtitle TEXT DEFAULT '',
		position REAL NOT NULL,
		color TEXT DEFAULT NULL,
		layout TEXT DEFAULT 'list',
		max_tasks INTEGER DEFAULT NULL,
		is_default BOOLEAN DEFAULT 0,
		PRIMARY KEY (project_id, name),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		title TEXT NOT NULL,
		bucket TEXT NOT NULL,
		position REAL NOT NULL,
		tags TEXT NOT NULL,
		filename TEXT NOT NULL,
		body TEXT DEFAULT '',
		due_date TEXT DEFAULT NULL,
		priority TEXT DEFAULT NULL,
		color TEXT DEFAULT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket);
	CREATE INDEX IF NOT EXISTS idx_buckets_project ON buckets(project_id);
	`

	if _, err := DB.Exec(schema); err != nil {
		return err
	}

	return nil
}

func CloseDB() {
	if DB != nil {
		_ = DB.Close()
		DB = nil
	}
}
