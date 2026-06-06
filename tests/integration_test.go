package tests

import (
	"bytes"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"jotter/backend/internal/app"
	"jotter/backend/internal/db"
	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/system"
	"jotter/backend/internal/features/task"
)

func TestIntegration(t *testing.T) {
	// Setup temporary directory
	tempDir, err := os.MkdirTemp("", "jotter-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "tasks.db")
	tasksDir := filepath.Join(tempDir, "tasks")
	_ = os.MkdirAll(tasksDir, 0755)

	// Initialize DB
	if err := db.InitDB(dbPath); err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}
	defer db.CloseDB()

	// Ensure projects.json exists
	_, _ = project.LoadProjectsFile(tasksDir)

	// Run initial sync to populate default project/columns in database
	if _, err := system.SyncDBWithFiles(tasksDir); err != nil {
		t.Fatalf("Failed to run initial sync: %v", err)
	}

	// Initialize router using the same logic as the real app
	// Note: We don't serve static files in tests, so we pass an empty embed.FS
	r := app.BuildRouter("ERROR", tasksDir, false, embed.FS{})

	var projectID string

	// 1. Test projects loading (creates default project)
	t.Run("Get Projects Initial", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/projects", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var projects []project.Response
		if err := json.Unmarshal(w.Body.Bytes(), &projects); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Initial load without projects.json creates a default project
		if len(projects) != 1 {
			t.Errorf("Expected 1 default project, got %d", len(projects))
		}
		if projects[0].ID != "default" {
			t.Errorf("Expected default project ID, got %s", projects[0].ID)
		}
	})

	// 2. Test project creation
	t.Run("Create Project", func(t *testing.T) {
		payload := project.Create{
			Title: "Test Project",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/projects", bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", w.Code)
		}

		var res project.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Title != "Test Project" {
			t.Errorf("Expected project title 'Test Project', got '%s'", res.Title)
		}
		projectID = res.ID
		if projectID != "test-project" {
			t.Errorf("Expected slug 'test-project', got '%s'", projectID)
		}
	})

	// 3. Test list buckets (columns)
	t.Run("Get Buckets Initial", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/buckets", projectID)
		req := httptest.NewRequest("GET", url, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var buckets []bucket.Response
		if err := json.Unmarshal(w.Body.Bytes(), &buckets); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Default project creation populates default columns (backlog, todo, in-progress, done, archive)
		if len(buckets) != 5 {
			t.Errorf("Expected 5 default buckets, got %d", len(buckets))
		}
	})

	// 4. Test bucket creation
	t.Run("Create Bucket", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/buckets", projectID)
		payload := bucket.Create{
			Title: "Review",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", w.Code)
		}

		var res bucket.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Name != "review" || res.Title != "Review" {
			t.Errorf("Expected bucket name 'review', got '%s'", res.Name)
		}
	})

	var taskID string

	// 5. Test task creation
	t.Run("Create Task", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/tasks", projectID)
		payload := task.Create{
			Title:  "Test Task",
			Bucket: "todo",
			Body:   "Task description content",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", w.Code)
		}

		var res task.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Title != "Test Task" || res.Bucket != "todo" || res.Body != "Task description content" {
			t.Errorf("Task data mismatch in response: %+v", res)
		}
		taskID = res.ID
	})

	// 6. Test task fetch
	t.Run("Get Task", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/tasks/%s", projectID, taskID)
		req := httptest.NewRequest("GET", url, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res task.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.ID != taskID || res.Title != "Test Task" {
			t.Errorf("Fetched task data mismatch: %+v", res)
		}
	})

	// 7. Test task move
	t.Run("Move Task", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/tasks/%s/move", projectID, taskID)
		payload := task.Move{
			Bucket:   "review",
			Position: 1500.0,
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res task.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Bucket != "review" || res.Position != 1500.0 {
			t.Errorf("Move task payload mismatch: %+v", res)
		}

		// Check database status
		var dbBucket string
		var dbPos float64
		err := db.DB.QueryRow("SELECT bucket, position FROM tasks WHERE id = ?", taskID).Scan(&dbBucket, &dbPos)
		if err != nil {
			t.Fatalf("Failed to query DB for task: %v", err)
		}
		if dbBucket != "review" || dbPos != 1500.0 {
			t.Errorf("Database task values not updated: bucket=%s, position=%f", dbBucket, dbPos)
		}
	})

	// 8. Test system sync
	t.Run("System Sync", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/system/sync", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res["status"] != "success" {
			t.Errorf("Expected status 'success', got '%v'", res["status"])
		}

		// One task was created and synced
		if syncCount, ok := res["synchronized_tasks"].(float64); !ok || syncCount != 1 {
			t.Errorf("Expected 1 synchronized task, got %v", res["synchronized_tasks"])
		}
	})

	// 9. Test task deletion
	t.Run("Delete Task", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/tasks/%s", projectID, taskID)
		req := httptest.NewRequest("DELETE", url, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		// Verify deletion in filesystem
		_, _, _, errFile := task.GetTaskFilePath(tasksDir, taskID)
		if errFile == nil {
			t.Errorf("Task markdown file was not deleted from disk")
		}

		// Verify deletion in DB
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM tasks WHERE id = ?", taskID).Scan(&dummy)
		if err != sql.ErrNoRows {
			t.Errorf("Task still exists in database: %v", err)
		}
	})

	// 10. Test project deletion
	t.Run("Delete Project", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s", projectID)
		req := httptest.NewRequest("DELETE", url, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		// Check directory is deleted
		projectDir := filepath.Join(tasksDir, projectID)
		if _, err := os.Stat(projectDir); !os.IsNotExist(err) {
			t.Errorf("Project directory was not removed from filesystem")
		}

		// Check DB is deleted
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err != sql.ErrNoRows {
			t.Errorf("Project still exists in database: %v", err)
		}
	})
}
