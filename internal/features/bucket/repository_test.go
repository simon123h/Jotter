package bucket

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"jotter/backend/internal/db"
)

func initTestDB(t *testing.T) (*sql.DB, string) {
	tempDir, err := os.MkdirTemp("", "bucket-repo-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tempDir, "tasks.db")

	if err := db.InitDB(dbPath); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to init DB: %v", err)
	}

	// Insert a test project because buckets have foreign key constraints pointing to projects
	_, err = db.DB.Exec("INSERT INTO projects (id, title, created_at) VALUES ('test-proj', 'Test Project', '2026-01-01T00:00:00Z')")
	if err != nil {
		db.CloseDB()
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to insert test project: %v", err)
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

	// 1. ProjectExists
	exists, err := repo.ProjectExists(ctx, "test-proj")
	if err != nil || !exists {
		t.Errorf("ProjectExists expected true, got %t, err=%v", exists, err)
	}

	exists, err = repo.ProjectExists(ctx, "non-existent")
	if err != nil || exists {
		t.Errorf("ProjectExists expected false, got %t, err=%v", exists, err)
	}

	// 2. GetNextPosition (initial should be 1000)
	pos, err := repo.GetNextPosition(ctx, "test-proj")
	if err != nil || pos != 1000.0 {
		t.Errorf("GetNextPosition expected 1000.0, got %f, err=%v", pos, err)
	}

	// 3. Create bucket
	colorCode := "#00ff00"
	maxTasksVal := 5
	b := Response{
		Name:      "todo",
		Title:     "Todo",
		Subtitle:  "Things to do",
		Position:  1000.0,
		Color:     &colorCode,
		Layout:    "list",
		MaxTasks:  &maxTasksVal,
		IsDefault: true,
	}

	err = repo.Create(ctx, "test-proj", b)
	if err != nil {
		t.Fatalf("Create bucket failed: %v", err)
	}

	// 4. BucketExists
	bExists, err := repo.BucketExists(ctx, "test-proj", "todo")
	if err != nil || !bExists {
		t.Errorf("BucketExists expected true, got %t, err=%v", bExists, err)
	}

	// 5. GetNextPosition (should be 2000 now)
	pos, err = repo.GetNextPosition(ctx, "test-proj")
	if err != nil || pos != 2000.0 {
		t.Errorf("GetNextPosition expected 2000.0, got %f, err=%v", pos, err)
	}

	// 6. GetOne
	fetched, err := repo.GetOne(ctx, "test-proj", "todo")
	if err != nil || fetched == nil {
		t.Fatalf("GetOne failed: %v", err)
	}
	if fetched.Title != "Todo" || *fetched.Color != colorCode || *fetched.MaxTasks != 5 {
		t.Errorf("GetOne mismatch: %+v", fetched)
	}

	// 7. GetAll
	all, err := repo.GetAll(ctx, "test-proj")
	if err != nil || len(all) != 1 {
		t.Errorf("GetAll failed: %v, len=%d", err, len(all))
	}

	// 8. Update
	newColor := "#0000ff"
	newMaxTasks := 10
	bUpdate := Response{
		Name:      "todo",
		Title:     "Todo Updated",
		Subtitle:  "Things to do (updated)",
		Position:  1200.0,
		Color:     &newColor,
		Layout:    "board",
		MaxTasks:  &newMaxTasks,
		IsDefault: false,
	}
	err = repo.Update(ctx, "test-proj", "todo", bUpdate)
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	fetched2, _ := repo.GetOne(ctx, "test-proj", "todo")
	if fetched2.Title != "Todo Updated" || *fetched2.Color != newColor || *fetched2.MaxTasks != 10 || fetched2.Position != 1200.0 {
		t.Errorf("Update mismatch: %+v", fetched2)
	}

	// 9. HasTasks (no tasks inserted yet)
	hasTasks, count, err := repo.HasTasks(ctx, "test-proj", "todo")
	if err != nil || hasTasks || count != 0 {
		t.Errorf("HasTasks expected false/0, got %t/%d, err=%v", hasTasks, count, err)
	}

	// 10. Delete
	err = repo.Delete(ctx, "test-proj", "todo")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	bExists, _ = repo.BucketExists(ctx, "test-proj", "todo")
	if bExists {
		t.Errorf("Bucket still exists after deletion")
	}
}

func TestFileRepository(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "bucket-file-repo-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create project directory first since columns are stored in project folders
	projDir := filepath.Join(tempDir, "test-proj")
	_ = os.MkdirAll(projDir, 0755)

	repo := NewFileRepository()

	// 1. Load when file doesn't exist (should auto-create 5 default buckets)
	buckets, err := repo.LoadBuckets(tempDir, "test-proj")
	if err != nil {
		t.Fatalf("Expected no error when file doesn't exist, got: %v", err)
	}
	if len(buckets) != 5 {
		t.Errorf("Expected 5 default buckets when file does not exist, got %v", buckets)
	}

	// 2. Write buckets
	bList := []map[string]interface{}{
		{"name": "todo", "title": "Todo"},
		{"name": "done", "title": "Done"},
	}

	err = repo.WriteBuckets(tempDir, "test-proj", bList)
	if err != nil {
		t.Fatalf("Failed to write buckets: %v", err)
	}

	// Load and verify
	buckets2, err := repo.LoadBuckets(tempDir, "test-proj")
	if err != nil {
		t.Fatalf("Failed to load buckets: %v", err)
	}
	if len(buckets2) != 2 || buckets2[0]["name"] != "todo" {
		t.Errorf("Buckets mismatch after write/load: %v", buckets2)
	}
}
