package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/handlers"
	"jotter/backend/internal/models"
	"jotter/backend/internal/storage"
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

	// Run initial sync to populate default project/columns in database
	if _, err := storage.SyncDBWithFiles(tasksDir); err != nil {
		t.Fatalf("Failed to run initial sync: %v", err)
	}

	// Initialize router
	r := chi.NewRouter()
	handlers.RegisterProjectRoutes(r, tasksDir)
	handlers.RegisterBucketRoutes(r, tasksDir)
	handlers.RegisterTaskRoutes(r, tasksDir)
	handlers.RegisterSystemRoutes(r, tasksDir)

	var projectID string

	// 1. Test projects loading (creates default project)
	t.Run("Get Projects Initial", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/projects", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var projects []models.ProjectResponse
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
		payload := models.ProjectCreate{
			Title: "Test Project",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/projects", bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", w.Code)
		}

		var res models.ProjectResponse
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

		var buckets []models.BucketResponse
		if err := json.Unmarshal(w.Body.Bytes(), &buckets); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		// Default project creation populates default columns (backlog, todo, in-progress, done)
		if len(buckets) != 4 {
			t.Errorf("Expected 4 default buckets, got %d", len(buckets))
		}
	})

	// 4. Test bucket creation
	t.Run("Create Bucket", func(t *testing.T) {
		url := fmt.Sprintf("/projects/%s/buckets", projectID)
		payload := models.BucketCreate{
			Title: "Review",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", w.Code)
		}

		var res models.BucketResponse
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
		payload := models.TaskCreate{
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

		var res models.TaskResponse
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

		var res models.TaskResponse
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
		payload := models.TaskMove{
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

		var res models.TaskResponse
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
		_, _, _, errFile := storage.GetTaskFilePath(tasksDir, taskID)
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
