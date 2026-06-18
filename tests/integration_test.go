package tests

import (
	"bytes"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"jotter/backend/internal/app"
	"jotter/backend/internal/db"
	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/settings"
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
		req := httptest.NewRequest("GET", "/api/projects", nil)
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
		req := httptest.NewRequest("POST", "/api/projects", bytes.NewBuffer(body))
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

	// 2b. Test project update
	t.Run("Update Project", func(t *testing.T) {
		newTitle := "Updated Test Project"
		payload := project.Update{
			Title: &newTitle,
		}
		body, _ := json.Marshal(payload)
		url := fmt.Sprintf("/api/projects/%s", projectID)
		req := httptest.NewRequest("PUT", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res project.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Title != "Updated Test Project" {
			t.Errorf("Expected project title 'Updated Test Project', got '%s'", res.Title)
		}
	})

	// 3. Test list buckets (columns)
	t.Run("Get Buckets Initial", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s/buckets", projectID)
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
		url := fmt.Sprintf("/api/projects/%s/buckets", projectID)
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

	// 4b. Test Update Bucket
	t.Run("Update Bucket", func(t *testing.T) {
		newTitle := "Needs Review"
		colorCode := "#ff0000"
		payload := bucket.Update{
			Title: &newTitle,
			Color: &colorCode,
		}
		body, _ := json.Marshal(payload)
		url := fmt.Sprintf("/api/projects/%s/buckets/review", projectID)
		req := httptest.NewRequest("PUT", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res bucket.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Title != "Needs Review" || res.Color == nil || *res.Color != "#ff0000" {
			t.Errorf("Expected title 'Needs Review' and color '#ff0000', got title='%s', color='%v'", res.Title, res.Color)
		}
	})

	var taskID string

	// 5. Test task creation
	t.Run("Create Task", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s/tasks", projectID)
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

	// 5b. Test List Tasks
	t.Run("List Tasks", func(t *testing.T) {
		// List all tasks globally
		reqAll := httptest.NewRequest("GET", "/api/tasks", nil)
		wAll := httptest.NewRecorder()
		r.ServeHTTP(wAll, reqAll)

		if wAll.Code != http.StatusOK {
			t.Errorf("Expected status 200 for global task list, got %d", wAll.Code)
		}

		var tasksAll []task.Response
		if err := json.Unmarshal(wAll.Body.Bytes(), &tasksAll); err != nil {
			t.Fatalf("Failed to parse global task list: %v", err)
		}

		if len(tasksAll) != 1 || tasksAll[0].ID != taskID {
			t.Errorf("Expected global task list to contain exactly 1 task with ID %s, got %v", taskID, tasksAll)
		}

		// List tasks for specific project
		urlProj := fmt.Sprintf("/api/projects/%s/tasks", projectID)
		reqProj := httptest.NewRequest("GET", urlProj, nil)
		wProj := httptest.NewRecorder()
		r.ServeHTTP(wProj, reqProj)

		if wProj.Code != http.StatusOK {
			t.Errorf("Expected status 200 for project task list, got %d", wProj.Code)
		}

		var tasksProj []task.Response
		_ = json.Unmarshal(wProj.Body.Bytes(), &tasksProj)

		if len(tasksProj) != 1 || tasksProj[0].ID != taskID {
			t.Errorf("Expected project task list to contain exactly 1 task with ID %s, got %v", taskID, tasksProj)
		}
	})

	// 6. Test task fetch
	t.Run("Get Task", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s/tasks/%s", projectID, taskID)
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

	// 6b. Test Update Task
	t.Run("Update Task", func(t *testing.T) {
		newTitle := "Updated Task Title"
		newBody := "Updated body description content"
		newPriority := "high"
		tags := []string{"bug", "important"}
		payload := task.Update{
			Title:    &newTitle,
			Body:     &newBody,
			Priority: &newPriority,
			Tags:     &tags,
		}
		body, _ := json.Marshal(payload)
		url := fmt.Sprintf("/api/projects/%s/tasks/%s", projectID, taskID)
		req := httptest.NewRequest("PUT", url, bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var res task.Response
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if res.Title != "Updated Task Title" || res.Body != "Updated body description content" || res.Priority == nil || *res.Priority != "high" || len(res.Tags) != 2 {
			t.Errorf("Updated task mismatch: %+v", res)
		}
	})

	// 6c. Test Task Attachments
	t.Run("Task Attachments", func(t *testing.T) {
		// 1. Upload Attachment
		urlUpload := fmt.Sprintf("/api/projects/%s/tasks/%s/attachments", projectID, taskID)

		var b bytes.Buffer
		writer := multipart.NewWriter(&b)
		part, err := writer.CreateFormFile("file", "test_doc.txt")
		if err != nil {
			t.Fatalf("Failed to create form file: %v", err)
		}
		_, _ = part.Write([]byte("This is some sample test document text."))
		_ = writer.Close()

		reqUpload := httptest.NewRequest("POST", urlUpload, &b)
		reqUpload.Header.Set("Content-Type", writer.FormDataContentType())
		wUpload := httptest.NewRecorder()
		r.ServeHTTP(wUpload, reqUpload)

		if wUpload.Code != http.StatusOK {
			t.Errorf("Expected status 200 for upload, got %d. Body: %s", wUpload.Code, wUpload.Body.String())
		}

		var resUpload task.Response
		if err := json.Unmarshal(wUpload.Body.Bytes(), &resUpload); err != nil {
			t.Fatalf("Failed to parse upload response: %v", err)
		}

		if len(resUpload.Attachments) != 1 || resUpload.Attachments[0] != "test_doc.txt" {
			t.Errorf("Expected attachment list to have 'test_doc.txt', got: %v", resUpload.Attachments)
		}

		// 2. Download Attachment
		urlDownload := fmt.Sprintf("/api/projects/%s/tasks/%s/attachments/test_doc.txt", projectID, taskID)
		reqDownload := httptest.NewRequest("GET", urlDownload, nil)
		wDownload := httptest.NewRecorder()
		r.ServeHTTP(wDownload, reqDownload)

		if wDownload.Code != http.StatusOK {
			t.Errorf("Expected status 200 for download, got %d", wDownload.Code)
		}

		downloadContent := wDownload.Body.String()
		if downloadContent != "This is some sample test document text." {
			t.Errorf("Expected download content 'This is some sample test document text.', got %q", downloadContent)
		}

		// 3. Delete Attachment
		urlDelete := fmt.Sprintf("/api/projects/%s/tasks/%s/attachments/test_doc.txt", projectID, taskID)
		reqDelete := httptest.NewRequest("DELETE", urlDelete, nil)
		wDelete := httptest.NewRecorder()
		r.ServeHTTP(wDelete, reqDelete)

		if wDelete.Code != http.StatusOK {
			t.Errorf("Expected status 200 for delete, got %d", wDelete.Code)
		}

		var resDelete task.Response
		if err := json.Unmarshal(wDelete.Body.Bytes(), &resDelete); err != nil {
			t.Fatalf("Failed to parse delete response: %v", err)
		}

		if len(resDelete.Attachments) != 0 {
			t.Errorf("Expected attachment list to be empty after delete, got: %v", resDelete.Attachments)
		}
	})

	// 7. Test task move
	t.Run("Move Task", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s/tasks/%s/move", projectID, taskID)
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
		req := httptest.NewRequest("POST", "/api/system/sync", nil)
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
		url := fmt.Sprintf("/api/projects/%s/tasks/%s", projectID, taskID)
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

	// 9b. Test Delete Bucket
	t.Run("Delete Bucket", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s/buckets/review", projectID)
		req := httptest.NewRequest("DELETE", url, nil)
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
			t.Errorf("Expected success, got %v", res["status"])
		}
	})

	// 9c. Test Settings (Get and Post Settings)
	t.Run("Get and Save Settings", func(t *testing.T) {
		// Get Settings
		reqGet := httptest.NewRequest("GET", "/api/settings", nil)
		wGet := httptest.NewRecorder()
		r.ServeHTTP(wGet, reqGet)

		if wGet.Code != http.StatusOK {
			t.Errorf("Expected status 200 for GET settings, got %d", wGet.Code)
		}

		var loadedSettings settings.AppSettings
		if err := json.Unmarshal(wGet.Body.Bytes(), &loadedSettings); err != nil {
			t.Fatalf("Failed to parse GET settings: %v", err)
		}

		// Save Settings
		loadedSettings.CurrentTheme = "nordic-dark"
		loadedSettings.HideDoneColumn = false
		loadedSettings.AutoSyncInterval = 30

		body, _ := json.Marshal(loadedSettings)
		reqPost := httptest.NewRequest("POST", "/api/settings", bytes.NewBuffer(body))
		wPost := httptest.NewRecorder()
		r.ServeHTTP(wPost, reqPost)

		if wPost.Code != http.StatusOK {
			t.Errorf("Expected status 200 for POST settings, got %d", wPost.Code)
		}

		// Re-fetch Settings to verify change
		reqGet2 := httptest.NewRequest("GET", "/api/settings", nil)
		wGet2 := httptest.NewRecorder()
		r.ServeHTTP(wGet2, reqGet2)

		var verifiedSettings settings.AppSettings
		_ = json.Unmarshal(wGet2.Body.Bytes(), &verifiedSettings)

		if verifiedSettings.CurrentTheme != "nordic-dark" || verifiedSettings.HideDoneColumn != false || verifiedSettings.AutoSyncInterval != 30 {
			t.Errorf("Expected theme 'nordic-dark', HideDoneColumn false, AutoSyncInterval 30, got: %+v", verifiedSettings)
		}
	})

	// 10. Test project deletion
	t.Run("Delete Project", func(t *testing.T) {
		url := fmt.Sprintf("/api/projects/%s", projectID)
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
