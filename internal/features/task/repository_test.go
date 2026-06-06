package task

import (
	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/project"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseFrontmatter(t *testing.T) {
	t.Run("Valid Frontmatter", func(t *testing.T) {
		content := "---\nid: 0123456789ABCDEFGHJKMNPQRS\ntitle: Test Task\ntags:\n  - Tag1\n  - Tag2\n---\nBody content here"
		fm, body, err := ParseFrontmatter(content)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if fm.Title != "Test Task" {
			t.Errorf("Expected title 'Test Task', got %q", fm.Title)
		}
		if body != "Body content here" {
			t.Errorf("Expected body 'Body content here', got %q", body)
		}
		if len(fm.Tags) != 2 || fm.Tags[0] != "tag1" {
			t.Errorf("Tags mismatch, expected [tag1 tag2], got %v", fm.Tags)
		}
	})

	t.Run("Missing Start Separator", func(t *testing.T) {
		content := "title: No Start\n---\nBody"
		_, _, err := ParseFrontmatter(content)
		if err == nil {
			t.Error("Expected error for missing start separator")
		}
	})

	t.Run("Missing End Separator", func(t *testing.T) {
		content := "---\ntitle: No End\nBody"
		_, _, err := ParseFrontmatter(content)
		if err == nil {
			t.Error("Expected error for missing end separator")
		}
	})

	t.Run("Invalid YAML", func(t *testing.T) {
		content := "---\n  - invalid: [[\n---\nBody"
		_, _, err := ParseFrontmatter(content)
		if err == nil {
			t.Error("Expected error for invalid YAML")
		}
	})
}

func TestDumpFrontmatter(t *testing.T) {
	fm := &Frontmatter{
		ID:    "ID123",
		Title: "Test Dump",
		Tags:  []string{"a", "b"},
	}
	body := "Body text"
	res, err := DumpFrontmatter(fm, body)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !strings.Contains(res, "title: Test Dump") {
		t.Error("Dumped content missing title")
	}
	if !strings.HasSuffix(res, "Body text") {
		t.Error("Dumped content missing body")
	}
}

func TestProjectStorage(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "proj-storage-*")
	defer os.RemoveAll(tempDir)

	t.Run("Load Missing Projects File", func(t *testing.T) {
		projects, err := project.LoadProjectsFile(tempDir)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(projects) != 1 || projects[0]["id"] != "default" {
			t.Errorf("Expected 1 default project, got %v", projects)
		}
	})

	t.Run("Write and Load Projects", func(t *testing.T) {
		projects := []map[string]interface{}{
			{"id": "p1", "title": "Proj 1"},
			{"id": "p2", "title": "Proj 2"},
		}
		err := project.WriteProjectsFile(tempDir, projects)
		if err != nil {
			t.Fatalf("Failed to write projects: %v", err)
		}

		loaded, _ := project.LoadProjectsFile(tempDir)
		if len(loaded) != 2 {
			t.Errorf("Expected 2 projects, got %d", len(loaded))
		}
	})
}

func TestBucketStorage(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "bucket-storage-*")
	defer os.RemoveAll(tempDir)
	projectID := "test-proj"

	t.Run("Load Missing Buckets File", func(t *testing.T) {
		buckets, err := bucket.LoadBucketsFile(tempDir, projectID)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(buckets) != 5 {
			t.Errorf("Expected 5 default buckets, got %d", len(buckets))
		}
	})

	t.Run("Write and Load Buckets", func(t *testing.T) {
		buckets := []map[string]interface{}{
			{"name": "b1", "title": "Bucket 1", "position": 100.0, "is_default": true},
		}
		err := bucket.WriteBucketsFile(tempDir, projectID, buckets)
		if err != nil {
			t.Fatalf("Failed to write buckets: %v", err)
		}

		loaded, _ := bucket.LoadBucketsFile(tempDir, projectID)
		if len(loaded) != 1 || loaded[0]["name"] != "b1" {
			t.Errorf("Bucket data mismatch: %v", loaded)
		}
	})
}

func TestTaskFileOperations(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "task-ops-*")
	defer os.RemoveAll(tempDir)
	projectID := "p1"
	taskID := "01H2PJEXF49F1T1Z1Z1Z1Z1Z1Z" // Valid-looking ULID

	t.Run("Write Task File", func(t *testing.T) {
		taskData := map[string]interface{}{
			"project_id": projectID,
			"title":      "Test Task",
			"bucket":     "todo",
			"position":   100.0,
			"tags":       []string{"t1"},
			"body":       "Content",
			"created_at": "2023-01-01T00:00:00Z",
			"updated_at": "2023-01-01T00:00:00Z",
		}
		filename, err := WriteTaskFile(tempDir, taskID, taskData)
		if err != nil {
			t.Fatalf("Failed to write task: %v", err)
		}
		if filename != taskID+".md" {
			t.Errorf("Expected filename %s.md, got %s", taskID, filename)
		}

		path := filepath.Join(tempDir, projectID, filename)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Error("Task file was not created in the correct project directory")
		}
	})

	t.Run("Get Task File Path - Direct", func(t *testing.T) {
		path, name, pID, err := GetTaskFilePath(tempDir, taskID)
		if err != nil {
			t.Fatalf("Failed to find task: %v", err)
		}
		if pID != projectID || name != taskID+".md" {
			t.Errorf("Path info mismatch: pID=%s, name=%s", pID, name)
		}
		if !strings.HasSuffix(path, filepath.Join(projectID, taskID+".md")) {
			t.Errorf("Unexpected path: %s", path)
		}
	})

	t.Run("Get Task File Path - Legacy Numeric", func(t *testing.T) {
		// Create a legacy file: 123-some-title.md
		legacyID := "123"
		legacyFilename := "000123-some-title.md"
		_ = os.MkdirAll(filepath.Join(tempDir, "default"), 0755)
		_ = os.WriteFile(filepath.Join(tempDir, "default", legacyFilename), []byte("---\nid: 123\n---"), 0644)

		path, name, pID, err := GetTaskFilePath(tempDir, legacyID)
		if err != nil {
			t.Fatalf("Failed to find legacy task: %v", err)
		}
		if pID != "default" || name != legacyFilename {
			t.Errorf("Legacy path info mismatch: pID=%s, name=%s", pID, name)
		}
		if !strings.HasSuffix(path, filepath.Join("default", legacyFilename)) {
			t.Errorf("Unexpected legacy path: %s", path)
		}
	})

	t.Run("Read Task File", func(t *testing.T) {
		res, err := ReadTaskFile(tempDir, taskID)
		if err != nil {
			t.Fatalf("Failed to read task: %v", err)
		}
		if res.Title != "Test Task" || res.ProjectID != projectID {
			t.Errorf("Read data mismatch: %+v", res)
		}
	})

	t.Run("Delete Task File", func(t *testing.T) {
		success := DeleteTaskFile(tempDir, taskID)
		if !success {
			t.Error("DeleteTaskFile returned false")
		}
		_, _, _, err := GetTaskFilePath(tempDir, taskID)
		if err == nil {
			t.Error("Task file still exists after deletion")
		}
	})
}
