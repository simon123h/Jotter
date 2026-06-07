package bucket

import (
	"context"
	"errors"
	"testing"
)

type mockDBRepository struct {
	ProjectExistsFunc   func(ctx context.Context, projectID string) (bool, error)
	BucketExistsFunc    func(ctx context.Context, projectID string, name string) (bool, error)
	GetNextPositionFunc func(ctx context.Context, projectID string) (float64, error)
	GetAllFunc          func(ctx context.Context, projectID string) ([]Response, error)
	GetOneFunc          func(ctx context.Context, projectID string, name string) (*Response, error)
	CreateFunc          func(ctx context.Context, projectID string, b Response) error
	UpdateFunc          func(ctx context.Context, projectID string, name string, b Response) error
	HasTasksFunc        func(ctx context.Context, projectID string, name string) (bool, int, error)
	DeleteFunc          func(ctx context.Context, projectID string, name string) error
}

func (m *mockDBRepository) ProjectExists(ctx context.Context, projectID string) (bool, error) {
	if m.ProjectExistsFunc != nil {
		return m.ProjectExistsFunc(ctx, projectID)
	}
	return true, nil
}

func (m *mockDBRepository) BucketExists(ctx context.Context, projectID string, name string) (bool, error) {
	if m.BucketExistsFunc != nil {
		return m.BucketExistsFunc(ctx, projectID, name)
	}
	return false, nil
}

func (m *mockDBRepository) GetNextPosition(ctx context.Context, projectID string) (float64, error) {
	if m.GetNextPositionFunc != nil {
		return m.GetNextPositionFunc(ctx, projectID)
	}
	return 1000.0, nil
}

func (m *mockDBRepository) GetAll(ctx context.Context, projectID string) ([]Response, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx, projectID)
	}
	return nil, nil
}

func (m *mockDBRepository) GetOne(ctx context.Context, projectID string, name string) (*Response, error) {
	if m.GetOneFunc != nil {
		return m.GetOneFunc(ctx, projectID, name)
	}
	return nil, nil
}

func (m *mockDBRepository) Create(ctx context.Context, projectID string, b Response) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, projectID, b)
	}
	return nil
}

func (m *mockDBRepository) Update(ctx context.Context, projectID string, name string, b Response) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, projectID, name, b)
	}
	return nil
}

func (m *mockDBRepository) HasTasks(ctx context.Context, projectID string, name string) (bool, int, error) {
	if m.HasTasksFunc != nil {
		return m.HasTasksFunc(ctx, projectID, name)
	}
	return false, 0, nil
}

func (m *mockDBRepository) Delete(ctx context.Context, projectID string, name string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, projectID, name)
	}
	return nil
}

type mockFileRepository struct {
	LoadBucketsFunc  func(tasksDir string, projectID string) ([]map[string]interface{}, error)
	WriteBucketsFunc func(tasksDir string, projectID string, buckets []map[string]interface{}) error
}

func (m *mockFileRepository) LoadBuckets(tasksDir string, projectID string) ([]map[string]interface{}, error) {
	if m.LoadBucketsFunc != nil {
		return m.LoadBucketsFunc(tasksDir, projectID)
	}
	return nil, nil
}

func (m *mockFileRepository) WriteBuckets(tasksDir string, projectID string, buckets []map[string]interface{}) error {
	if m.WriteBucketsFunc != nil {
		return m.WriteBucketsFunc(tasksDir, projectID, buckets)
	}
	return nil
}

func TestGetBuckets_ProjectNotFound(t *testing.T) {
	dbRepo := &mockDBRepository{
		ProjectExistsFunc: func(ctx context.Context, projectID string) (bool, error) {
			return false, nil
		},
	}
	fileRepo := &mockFileRepository{}

	svc := NewService(dbRepo, fileRepo)
	_, err := svc.GetBuckets(context.Background(), "invalid-proj")
	if !errors.Is(err, ErrProjectNotFound) {
		t.Errorf("expected ErrProjectNotFound, got %v", err)
	}
}

func TestCreateBucket_Success(t *testing.T) {
	dbRepo := &mockDBRepository{
		ProjectExistsFunc: func(ctx context.Context, projectID string) (bool, error) {
			return true, nil
		},
		BucketExistsFunc: func(ctx context.Context, projectID string, name string) (bool, error) {
			return false, nil
		},
		GetNextPositionFunc: func(ctx context.Context, projectID string) (float64, error) {
			return 2500.0, nil
		},
		CreateFunc: func(ctx context.Context, projectID string, b Response) error {
			if b.Name != "in-progress" {
				t.Errorf("expected name 'in-progress', got '%s'", b.Name)
			}
			if b.Position != 2500.0 {
				t.Errorf("expected position 2500, got %f", b.Position)
			}
			return nil
		},
		GetAllFunc: func(ctx context.Context, projectID string) ([]Response, error) {
			return []Response{
				{Name: "in-progress", Title: "In Progress", Position: 2500.0},
			}, nil
		},
	}

	fileRepo := &mockFileRepository{
		WriteBucketsFunc: func(tasksDir string, projectID string, buckets []map[string]interface{}) error {
			if len(buckets) != 1 {
				t.Errorf("expected 1 bucket written to file, got %d", len(buckets))
			}
			return nil
		},
	}

	svc := NewService(dbRepo, fileRepo)
	req := Create{
		Title: "In Progress",
	}

	res, err := svc.CreateBucket(context.Background(), "dir", "test-project", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Name != "in-progress" {
		t.Errorf("expected 'in-progress', got '%s'", res.Name)
	}
}

func TestCreateBucket_FileWriteFailureRollback(t *testing.T) {
	dbDeleted := false
	dbRepo := &mockDBRepository{
		ProjectExistsFunc: func(ctx context.Context, projectID string) (bool, error) {
			return true, nil
		},
		BucketExistsFunc: func(ctx context.Context, projectID string, name string) (bool, error) {
			return false, nil
		},
		CreateFunc: func(ctx context.Context, projectID string, b Response) error {
			return nil
		},
		DeleteFunc: func(ctx context.Context, projectID string, name string) error {
			dbDeleted = true
			return nil
		},
		GetAllFunc: func(ctx context.Context, projectID string) ([]Response, error) {
			return []Response{}, nil
		},
	}

	fileRepo := &mockFileRepository{
		WriteBucketsFunc: func(tasksDir string, projectID string, buckets []map[string]interface{}) error {
			return errors.New("disk is full")
		},
	}

	svc := NewService(dbRepo, fileRepo)
	req := Create{
		Title: "In Progress",
	}

	_, err := svc.CreateBucket(context.Background(), "dir", "test-project", req)
	if err == nil {
		t.Fatal("expected file sync write error, got nil")
	}

	if !dbDeleted {
		t.Error("expected DB creation to be rolled back/deleted, but it was not")
	}
}

func TestDeleteBucket_NotEmptyError(t *testing.T) {
	dbRepo := &mockDBRepository{
		ProjectExistsFunc: func(ctx context.Context, projectID string) (bool, error) {
			return true, nil
		},
		GetOneFunc: func(ctx context.Context, projectID string, name string) (*Response, error) {
			return &Response{Name: "todo", Title: "To Do"}, nil
		},
		HasTasksFunc: func(ctx context.Context, projectID string, name string) (bool, int, error) {
			return true, 3, nil
		},
	}
	fileRepo := &mockFileRepository{}

	svc := NewService(dbRepo, fileRepo)
	err := svc.DeleteBucket(context.Background(), "dir", "test-project", "todo")
	if !errors.Is(err, ErrBucketNotEmpty) {
		t.Errorf("expected ErrBucketNotEmpty error, got %v", err)
	}
}
