package system

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"jotter/backend/internal/features/settings"
)

type mockDBRepository struct {
	projects        []ProjectSyncInfo
	getErr          error
	syncErr         error
	rebuiltProjects []map[string]interface{}
	rebuiltBuckets  []BucketSyncInfo
	rebuiltTasks    []TaskSyncInfo
}

func (m *mockDBRepository) GetProjects(ctx context.Context) ([]ProjectSyncInfo, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.projects, nil
}

func (m *mockDBRepository) RebuildIndex(ctx context.Context, projects []map[string]interface{}, buckets []BucketSyncInfo, tasks []TaskSyncInfo) (int, error) {
	if m.syncErr != nil {
		return 0, m.syncErr
	}
	m.rebuiltProjects = projects
	m.rebuiltBuckets = buckets
	m.rebuiltTasks = tasks
	return len(tasks), nil
}

type mockDirEntry struct {
	name  string
	isDir bool
}

func (m mockDirEntry) Name() string               { return m.name }
func (m mockDirEntry) IsDir() bool                { return m.isDir }
func (m mockDirEntry) Type() os.FileMode          { return 0 }
func (m mockDirEntry) Info() (os.FileInfo, error) { return nil, nil }

type mockFileRepository struct {
	projects      []map[string]interface{}
	dirEntries    map[string][]os.DirEntry
	files         map[string][]byte
	loadErr       error
	gitSyncCalled []string
	writtenFiles  map[string][]byte
	deletedFiles  []string
	deletedDirs   []string
}

func (m *mockFileRepository) LoadProjectsFile(tasksDir string) ([]map[string]interface{}, error) {
	if m.loadErr != nil {
		return nil, m.loadErr
	}
	return m.projects, nil
}

func (m *mockFileRepository) ReadDir(path string) ([]os.DirEntry, error) {
	return m.dirEntries[path], nil
}

func (m *mockFileRepository) ReadFile(path string) ([]byte, error) {
	if data, ok := m.files[path]; ok {
		return data, nil
	}
	return nil, os.ErrNotExist
}

func (m *mockFileRepository) RemoveFile(path string) error {
	m.deletedFiles = append(m.deletedFiles, path)
	delete(m.files, path)
	return nil
}

func (m *mockFileRepository) RemoveDirAll(path string) error {
	m.deletedDirs = append(m.deletedDirs, path)
	return nil
}

func (m *mockFileRepository) WriteFile(path string, data []byte) error {
	if m.writtenFiles == nil {
		m.writtenFiles = make(map[string][]byte)
	}
	m.writtenFiles[path] = data
	m.files[path] = data
	return nil
}

func (m *mockFileRepository) GitSync(path string, remoteURL string) error {
	m.gitSyncCalled = append(m.gitSyncCalled, path+"->"+remoteURL)
	return nil
}

type mockSettingsRepository struct {
	settings settings.AppSettings
	loadErr  error
}

func (m *mockSettingsRepository) LoadSettings(tasksDir string) (settings.AppSettings, error) {
	if m.loadErr != nil {
		return settings.AppSettings{}, m.loadErr
	}
	return m.settings, nil
}

func (m *mockSettingsRepository) SaveSettings(tasksDir string, s settings.AppSettings) error {
	m.settings = s
	return nil
}

func TestSyncDBOnly_SuccessAndAutoPruning(t *testing.T) {
	// Let's configure a project "p1" with a done_clean_period of 2 days
	pRepo := &mockFileRepository{
		projects: []map[string]interface{}{
			{
				"id":                "p1",
				"title":             "Project 1",
				"created_at":        "2023-01-01T00:00:00Z",
				"done_clean_period": 2, // 2 days auto-clean
			},
		},
		dirEntries: map[string][]os.DirEntry{
			"tasks_dir": {
				mockDirEntry{name: "p1", isDir: true},
			},
			filepath.Join("tasks_dir", "p1"): {
				mockDirEntry{name: "buckets.json", isDir: false},
				mockDirEntry{name: "t_fresh.md", isDir: false},
				mockDirEntry{name: "t_stale.md", isDir: false},
			},
		},
		files: map[string][]byte{
			filepath.Join("tasks_dir", "p1", "buckets.json"): []byte(`[{"name":"done","title":"Done","position":1.0,"is_default":false}]`),
			// Fresh task: updated just now
			filepath.Join("tasks_dir", "p1", "t_fresh.md"): []byte("---\nid: t_fresh\ntitle: Fresh Task\nbucket: done\nposition: 100.0\nupdated_at: " + time.Now().UTC().Format(time.RFC3339Nano) + "\n---\nBody 1"),
			// Stale task: updated 5 days ago (should be auto-pruned!)
			filepath.Join("tasks_dir", "p1", "t_stale.md"): []byte("---\nid: t_stale\ntitle: Stale Task\nbucket: done\nposition: 200.0\nupdated_at: " + time.Now().Add(-5*24*time.Hour).UTC().Format(time.RFC3339Nano) + "\n---\nBody 2"),
		},
	}

	dbRepo := &mockDBRepository{}
	settingsRepo := &mockSettingsRepository{}
	svc := NewService(dbRepo, pRepo, settingsRepo)

	count, err := svc.SyncDBOnly(context.Background(), "tasks_dir")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// We expect 1 task to survive (t_fresh), and t_stale to be pruned
	if count != 1 {
		t.Errorf("Expected surviving tasks count to be 1, got %d", count)
	}

	// Verify database rebuild payload
	if len(dbRepo.rebuiltProjects) != 1 || dbRepo.rebuiltProjects[0]["id"] != "p1" {
		t.Errorf("Project rebuild mismatch, got: %v", dbRepo.rebuiltProjects)
	}
	if len(dbRepo.rebuiltBuckets) != 1 || dbRepo.rebuiltBuckets[0].Name != "done" {
		t.Errorf("Bucket rebuild mismatch, got: %v", dbRepo.rebuiltBuckets)
	}
	if len(dbRepo.rebuiltTasks) != 1 || dbRepo.rebuiltTasks[0].ID != "t_fresh" {
		t.Errorf("Task rebuild mismatch, got: %v", dbRepo.rebuiltTasks)
	}

	// Verify file auto-pruning triggers
	stalePath := filepath.Join("tasks_dir", "p1", "t_stale.md")
	foundStaleDeleted := false
	for _, d := range pRepo.deletedFiles {
		if d == stalePath {
			foundStaleDeleted = true
			break
		}
	}
	if !foundStaleDeleted {
		t.Error("Expected stale done task file to be deleted from disk during sync")
	}
}

func TestSync_GitSynchronization(t *testing.T) {
	dbRepo := &mockDBRepository{
		projects: []ProjectSyncInfo{
			{ID: "p1", RemoteURL: "git@github.com:user/p1.git"}, // Individual project Git remote
			{ID: "p2", RemoteURL: ""},                           // No individual remote
		},
	}
	pRepo := &mockFileRepository{
		projects: []map[string]interface{}{},
		files:    make(map[string][]byte),
		dirEntries: map[string][]os.DirEntry{
			"tasks_dir": {},
		},
	}
	settingsRepo := &mockSettingsRepository{
		settings: settings.AppSettings{
			GitRemoteURL: "git@github.com:user/global.git", // Global workspace remote
		},
	}

	svc := NewService(dbRepo, pRepo, settingsRepo)

	_, err := svc.Sync(context.Background(), "tasks_dir")
	if err != nil {
		t.Fatalf("Unexpected sync error: %v", err)
	}

	// Verify that dynamic .gitignore was written
	gitignoreData, exists := pRepo.files[filepath.Join("tasks_dir", ".gitignore")]
	if !exists {
		t.Fatal("Expected dynamic .gitignore file to be created")
	}
	gitignoreStr := string(gitignoreData)
	if !strings.Contains(gitignoreStr, "p1/") {
		t.Error("Expected individual remote projects to be added to .gitignore")
	}

	// Verify Git Sync called on both workspace and individual project
	expectedSyncs := []string{
		"tasks_dir->git@github.com:user/global.git",
		filepath.Join("tasks_dir", "p1") + "->git@github.com:user/p1.git",
	}

	for _, expected := range expectedSyncs {
		found := false
		for _, s := range pRepo.gitSyncCalled {
			if s == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected GitSync to be called with: %q, got: %v", expected, pRepo.gitSyncCalled)
		}
	}
}
