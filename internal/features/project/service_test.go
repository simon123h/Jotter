package project

import (
	"context"
	"errors"
	"testing"
)

type mockDBRepository struct {
	GetAllFunc func(ctx context.Context) ([]Response, error)
	CreateFunc func(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error
	UpdateFunc func(ctx context.Context, id string, title string, doneCleanPeriod *int, gitRemote *string) error
	DeleteFunc func(ctx context.Context, id string) error
}

func (m *mockDBRepository) GetAll(ctx context.Context) ([]Response, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx)
	}
	return nil, nil
}

func (m *mockDBRepository) Create(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, id, title, createdAt, doneCleanPeriod, gitRemote, defaultBuckets)
	}
	return nil
}

func (m *mockDBRepository) Update(ctx context.Context, id string, title string, doneCleanPeriod *int, gitRemote *string) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, id, title, doneCleanPeriod, gitRemote)
	}
	return nil
}

func (m *mockDBRepository) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

type mockFileRepository struct {
	LoadProjectsFunc     func(tasksDir string) ([]map[string]interface{}, error)
	WriteProjectsFunc    func(tasksDir string, projects []map[string]interface{}) error
	DeleteProjectDirFunc func(tasksDir string, projectID string) error
}

func (m *mockFileRepository) LoadProjects(tasksDir string) ([]map[string]interface{}, error) {
	if m.LoadProjectsFunc != nil {
		return m.LoadProjectsFunc(tasksDir)
	}
	return nil, nil
}

func (m *mockFileRepository) WriteProjects(tasksDir string, projects []map[string]interface{}) error {
	if m.WriteProjectsFunc != nil {
		return m.WriteProjectsFunc(tasksDir, projects)
	}
	return nil
}

func (m *mockFileRepository) DeleteProjectDir(tasksDir string, projectID string) error {
	if m.DeleteProjectDirFunc != nil {
		return m.DeleteProjectDirFunc(tasksDir, projectID)
	}
	return nil
}

func TestGetProjects(t *testing.T) {
	expected := []Response{
		{ID: "test-1", Title: "Test Project 1", CreatedAt: "2026-01-01"},
		{ID: "test-2", Title: "Test Project 2", CreatedAt: "2026-01-02"},
	}

	dbRepo := &mockDBRepository{
		GetAllFunc: func(ctx context.Context) ([]Response, error) {
			return expected, nil
		},
	}
	fileRepo := &mockFileRepository{}

	svc := NewService(dbRepo, fileRepo)
	res, err := svc.GetProjects(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(res) != len(expected) {
		t.Errorf("expected %d projects, got %d", len(expected), len(res))
	}
}

func TestCreateProject_Success(t *testing.T) {
	dbRepo := &mockDBRepository{
		CreateFunc: func(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error {
			if id != "hello-world" {
				t.Errorf("expected id 'hello-world', got '%s'", id)
			}
			return nil
		},
	}

	fileRepo := &mockFileRepository{
		LoadProjectsFunc: func(tasksDir string) ([]map[string]interface{}, error) {
			return []map[string]interface{}{}, nil
		},
		WriteProjectsFunc: func(tasksDir string, projects []map[string]interface{}) error {
			if len(projects) != 1 {
				t.Errorf("expected 1 project in written file, got %d", len(projects))
			}
			return nil
		},
	}

	svc := NewService(dbRepo, fileRepo)
	req := Create{
		Title: "Hello World",
	}

	res, err := svc.CreateProject(context.Background(), "dir", req, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.ID != "hello-world" {
		t.Errorf("expected response ID 'hello-world', got '%s'", res.ID)
	}
}

func TestCreateProject_Duplicate(t *testing.T) {
	dbRepo := &mockDBRepository{}
	fileRepo := &mockFileRepository{
		LoadProjectsFunc: func(tasksDir string) ([]map[string]interface{}, error) {
			return []map[string]interface{}{
				{"id": "duplicate-project"},
			}, nil
		},
	}

	svc := NewService(dbRepo, fileRepo)
	req := Create{
		Title: "Duplicate Project",
	}

	_, err := svc.CreateProject(context.Background(), "dir", req, nil, nil)
	if !errors.Is(err, ErrDuplicateProject) {
		t.Errorf("expected duplicate error, got %v", err)
	}
}

func TestCreateProject_DatabaseRollback(t *testing.T) {
	dbRepo := &mockDBRepository{
		CreateFunc: func(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error {
			return errors.New("database insertion failed")
		},
	}

	fileWrites := 0
	fileRepo := &mockFileRepository{
		LoadProjectsFunc: func(tasksDir string) ([]map[string]interface{}, error) {
			if fileWrites == 1 {
				// Simulated reload in rollback handling
				return []map[string]interface{}{{"id": "hello-world"}}, nil
			}
			return []map[string]interface{}{}, nil
		},
		WriteProjectsFunc: func(tasksDir string, projects []map[string]interface{}) error {
			fileWrites++
			if fileWrites == 2 {
				// Second write should be empty (rollback)
				if len(projects) != 0 {
					t.Errorf("expected rolled back empty array, got %d", len(projects))
				}
			}
			return nil
		},
	}

	svc := NewService(dbRepo, fileRepo)
	req := Create{
		Title: "Hello World",
	}

	_, err := svc.CreateProject(context.Background(), "dir", req, nil, nil)
	if err == nil {
		t.Fatal("expected creation error, got nil")
	}

	if fileWrites != 2 {
		t.Errorf("expected 2 file writes (addition + rollback deletion), got %d", fileWrites)
	}
}

func TestDeleteProject_PreventLastProjectDeletion(t *testing.T) {
	dbRepo := &mockDBRepository{}
	fileRepo := &mockFileRepository{
		LoadProjectsFunc: func(tasksDir string) ([]map[string]interface{}, error) {
			return []map[string]interface{}{
				{"id": "only-project"},
			}, nil
		},
	}

	svc := NewService(dbRepo, fileRepo)
	err := svc.DeleteProject(context.Background(), "dir", "only-project")
	if !errors.Is(err, ErrLastProject) {
		t.Errorf("expected last project deletion error, got %v", err)
	}
}
