package project

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"jotter/backend/internal/db"
)

func initTestDB(t *testing.T) (*sql.DB, string) {
	tempDir, err := os.MkdirTemp("", "project-repo-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tempDir, "tasks.db")

	if err := db.InitDB(dbPath); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to init DB: %v", err)
	}

	return db.DB, tempDir
}

func closeTestDB(tempDir string) {
	db.CloseDB()
	os.RemoveAll(tempDir)
}

func TestSQLRepository(t *testing.T) {
	database, tempDir := initTestDB(t)
	defer closeTestDB(tempDir)

	repo := NewSQLRepository(database)
	ctx := context.Background()

	// 1. Initially, no projects should be found
	projects, err := repo.GetAll(ctx)
	if err != nil {
		t.Fatalf("Failed to get projects: %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects, got %d", len(projects))
	}

	// 2. Create project
	doneClean := 30
	gitRemote := "https://github.com/user/project.git"
	defaultBuckets := []map[string]interface{}{
		{"name": "todo", "title": "Todo", "position": 1000.0, "is_default": true},
		{"name": "done", "title": "Done", "position": 2000.0, "is_default": false},
	}

	err = repo.Create(ctx, "test-proj", "Test Project", "2026-01-01T00:00:00Z", &doneClean, &gitRemote, defaultBuckets)
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Verify creation
	projects, err = repo.GetAll(ctx)
	if err != nil {
		t.Fatalf("Failed to get projects after creation: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("Expected 1 project, got %d", len(projects))
	}

	p := projects[0]
	if p.ID != "test-proj" || p.Title != "Test Project" || p.DoneCleanPeriod == nil || *p.DoneCleanPeriod != 30 || p.GitRemote == nil || *p.GitRemote != gitRemote {
		t.Errorf("Project mismatch: %+v", p)
	}

	// 3. Update project
	newTitle := "Updated Title"
	newDoneClean := 15
	newGitRemote := "https://github.com/user/updated.git"
	err = repo.Update(ctx, "test-proj", newTitle, &newDoneClean, &newGitRemote)
	if err != nil {
		t.Fatalf("Failed to update project: %v", err)
	}

	projects, _ = repo.GetAll(ctx)
	p = projects[0]
	if p.Title != newTitle || p.DoneCleanPeriod == nil || *p.DoneCleanPeriod != 15 || p.GitRemote == nil || *p.GitRemote != newGitRemote {
		t.Errorf("Updated project mismatch: %+v", p)
	}

	// 4. Delete project
	err = repo.Delete(ctx, "test-proj")
	if err != nil {
		t.Fatalf("Failed to delete project: %v", err)
	}

	projects, _ = repo.GetAll(ctx)
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects after deletion, got %d", len(projects))
	}
}

func TestFileRepository(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "project-file-repo-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	repo := NewFileRepository()

	// 1. Load when file doesn't exist (should auto-create default project)
	projects, err := repo.LoadProjects(tempDir)
	if err != nil {
		t.Fatalf("Expected no error when file doesn't exist, got: %v", err)
	}
	if len(projects) != 1 || projects[0]["id"] != "default" {
		t.Errorf("Expected default project when file does not exist, got: %v", projects)
	}

	// 2. Write projects
	pList := []map[string]interface{}{
		{"id": "p1", "title": "Project 1"},
		{"id": "p2", "title": "Project 2"},
	}

	err = repo.WriteProjects(tempDir, pList)
	if err != nil {
		t.Fatalf("Failed to write projects: %v", err)
	}

	// Load and verify
	projects2, err := repo.LoadProjects(tempDir)
	if err != nil {
		t.Fatalf("Failed to load projects: %v", err)
	}
	if len(projects2) != 2 || projects2[0]["id"] != "p1" {
		t.Errorf("Projects mismatch after write/load: %v", projects2)
	}

	// 3. Delete directory
	projDir := filepath.Join(tempDir, "p1")
	_ = os.MkdirAll(projDir, 0755)
	err = repo.DeleteProjectDir(tempDir, "p1")
	if err != nil {
		t.Fatalf("Failed to delete project directory: %v", err)
	}
	if _, err := os.Stat(projDir); !os.IsNotExist(err) {
		t.Errorf("Project directory still exists after deletion")
	}
}
