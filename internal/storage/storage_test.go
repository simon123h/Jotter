package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"Jotter - Local-First", "jotter-local-first"},
		{"Project 123!", "project-123"},
		{"  Spaces  And--Dashes  ", "spaces-and-dashes"},
		{"UPPER CASE", "upper-case"},
	}

	for _, tt := range tests {
		if res := Slugify(tt.input); res != tt.expected {
			t.Errorf("Slugify(%q) = %q, want %q", tt.input, res, tt.expected)
		}
	}
}

func TestGenerateULID(t *testing.T) {
	id1 := GenerateULID()
	id2 := GenerateULID()

	if len(id1) != 26 {
		t.Errorf("Generated ULID length = %d, want 26", len(id1))
	}
	if id1 == id2 {
		t.Errorf("Consecutive ULIDs are identical: %s", id1)
	}
}

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
		if len(fm.Tags) != 2 || fm.Tags[0] != "tag1" {
			t.Errorf("Tags mismatch or not lowercased: %v", fm.Tags)
		}
		if strings.TrimSpace(body) != "Body content here" {
			t.Errorf("Body mismatch: %q", body)
		}
	})

	t.Run("Missing Start Separator", func(t *testing.T) {
		content := "title: No Separator\n---\nBody"
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
		content := "---\ntitle: [unclosed bracket\n---\nBody"
		_, _, err := ParseFrontmatter(content)
		if err == nil {
			t.Error("Expected error for invalid YAML")
		}
	})
}

func TestDumpFrontmatter(t *testing.T) {
	fm := &TaskFrontmatter{
		ID:    "ID123",
		Title: "Test",
		Tags:  []string{"a", "b"},
	}
	body := "Some body text"
	res, err := DumpFrontmatter(fm, body)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if !strings.HasPrefix(res, "---") || !strings.HasSuffix(res, body) || !strings.Contains(res, "title: Test") {
		t.Errorf("Dumped content looks wrong:\n%s", res)
	}
}

func TestProjectStorage(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "storage-test-projects-*")
	defer os.RemoveAll(tempDir)

	t.Run("Load Missing Projects File", func(t *testing.T) {
		projs, err := LoadProjectsFile(tempDir)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(projs) != 1 || projs[0]["id"] != "default" {
			t.Errorf("Expected default project, got: %v", projs)
		}
		// Verify file was created
		if _, err := os.Stat(filepath.Join(tempDir, "projects.json")); err != nil {
			t.Error("projects.json was not created")
		}
	})

	t.Run("Write and Load Projects", func(t *testing.T) {
		projs := []map[string]interface{}{
			{"id": "p1", "title": "Project 1"},
			{"id": "p2", "title": "Project 2"},
		}
		err := WriteProjectsFile(tempDir, projs)
		if err != nil {
			t.Fatalf("Write error: %v", err)
		}

		loaded, err := LoadProjectsFile(tempDir)
		if err != nil {
			t.Fatalf("Load error: %v", err)
		}
		if len(loaded) != 2 || loaded[1]["id"] != "p2" {
			t.Errorf("Data mismatch. Loaded: %v", loaded)
		}
	})
}

func TestBucketStorage(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "storage-test-buckets-*")
	defer os.RemoveAll(tempDir)
	projectID := "test-proj"

	t.Run("Load Missing Buckets File", func(t *testing.T) {
		buckets, err := LoadBucketsFile(tempDir, projectID)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(buckets) != 5 {
			t.Errorf("Expected 5 default buckets, got %d", len(buckets))
		}
	})

	t.Run("Write and Load Buckets", func(t *testing.T) {
		buckets := []map[string]interface{}{
			{"name": "b1", "title": "Bucket 1", "position": 1.0},
		}
		err := WriteBucketsFile(tempDir, projectID, buckets)
		if err != nil {
			t.Fatalf("Write error: %v", err)
		}

		loaded, err := LoadBucketsFile(tempDir, projectID)
		if err != nil {
			t.Fatalf("Load error: %v", err)
		}
		if len(loaded) != 1 || loaded[0]["name"] != "b1" {
			t.Errorf("Data mismatch. Loaded: %v", loaded)
		}
	})
}

func TestTaskFileOperations(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "storage-test-tasks-*")
	defer os.RemoveAll(tempDir)
	projectID := "p1"
	taskID := "TASK-ULID-123"

	taskData := map[string]interface{}{
		"project_id": projectID,
		"title":      "Test Task",
		"bucket":     "todo",
		"position":   100.0,
		"tags":       []string{"t1"},
		"body":       "Task description",
		"created_at": "2024-01-01T12:00:00Z",
		"updated_at": "2024-01-01T12:00:00Z",
	}

	t.Run("Write Task File", func(t *testing.T) {
		filename, err := WriteTaskFile(tempDir, taskID, taskData)
		if err != nil {
			t.Fatalf("WriteTaskFile error: %v", err)
		}
		if filename != taskID+".md" {
			t.Errorf("Unexpected filename: %s", filename)
		}

		// Verify file existence
		path := filepath.Join(tempDir, projectID, filename)
		if _, err := os.Stat(path); err != nil {
			t.Error("Task file was not created at expected path")
		}
	})

	t.Run("Get Task File Path - Direct", func(t *testing.T) {
		path, fn, pID, err := GetTaskFilePath(tempDir, taskID)
		if err != nil {
			t.Fatalf("GetTaskFilePath error: %v", err)
		}
		if pID != projectID {
			t.Errorf("Expected projectID %s, got %s", projectID, pID)
		}
		if fn != taskID+".md" {
			t.Errorf("Expected filename %s.md, got %s", taskID, fn)
		}
		if !strings.Contains(path, filepath.Join(projectID, fn)) {
			t.Errorf("Path mismatch: %s", path)
		}
	})

	t.Run("Get Task File Path - Legacy Numeric", func(t *testing.T) {
		// Create a legacy file
		legacyID := "123"
		legacyFilename := "000123-Legacy-Task.md"
		err := os.MkdirAll(filepath.Join(tempDir, "default"), 0755)
		if err != nil {
			t.Fatal(err)
		}
		_ = os.WriteFile(filepath.Join(tempDir, "default", legacyFilename), []byte("---\ntitle: Legacy\n---"), 0644)

		_, fn, pID, err := GetTaskFilePath(tempDir, legacyID)
		if err != nil {
			t.Fatalf("Legacy GetTaskFilePath error: %v", err)
		}
		if pID != "default" {
			t.Errorf("Expected legacy projectID 'default', got %s", pID)
		}
		if fn != legacyFilename {
			t.Errorf("Expected legacy filename %s, got %s", legacyFilename, fn)
		}
	})

	t.Run("Read Task File", func(t *testing.T) {
		task, err := ReadTaskFile(tempDir, taskID)
		if err != nil {
			t.Fatalf("ReadTaskFile error: %v", err)
		}
		if task.Title != "Test Task" || task.Body != "Task description" {
			t.Errorf("Task data mismatch: %+v", task)
		}
	})

	t.Run("Delete Task File", func(t *testing.T) {
		deleted := DeleteTaskFile(tempDir, taskID)
		if !deleted {
			t.Error("Expected DeleteTaskFile to return true")
		}
		if _, _, _, err := GetTaskFilePath(tempDir, taskID); err == nil {
			t.Error("Task file still exists after deletion")
		}
	})
}
