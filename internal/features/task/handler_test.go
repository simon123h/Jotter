package task

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

type mockService struct {
	tasks      []Response
	task       *Response
	getErr     error
	createRes  *Response
	createErr  error
	updateRes  *Response
	updateErr  error
	deleteErr  error
	moveRes    *Response
	moveErr    error
	getCalled  bool
	createCall bool
	updateCall bool
	deleteCall bool
	moveCall   bool
}

func (m *mockService) GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error) {
	m.getCalled = true
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.tasks, nil
}

func (m *mockService) GetTaskByID(ctx context.Context, tasksDir string, taskID string) (*Response, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.task, nil
}

func (m *mockService) CreateTask(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error) {
	m.createCall = true
	if m.createErr != nil {
		return nil, m.createErr
	}
	return m.createRes, nil
}

func (m *mockService) UpdateTask(ctx context.Context, tasksDir string, projectID string, taskID string, raw map[string]interface{}, req Update, syncFn func(string, string) error) (*Response, error) {
	m.updateCall = true
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	return m.updateRes, nil
}

func (m *mockService) DeleteTask(ctx context.Context, tasksDir string, projectID string, taskID string) error {
	m.deleteCall = true
	if m.deleteErr != nil {
		return m.deleteErr
	}
	return nil
}

func (m *mockService) MoveTask(ctx context.Context, tasksDir string, projectID string, taskID string, req Move, syncFn func(string, string) error) (*Response, error) {
	m.moveCall = true
	if m.moveErr != nil {
		return nil, m.moveErr
	}
	return m.moveRes, nil
}

func (m *mockService) SaveAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string, file io.Reader) (*Response, error) {
	return nil, nil
}

func (m *mockService) DeleteAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (*Response, error) {
	return nil, nil
}

func (m *mockService) GetAttachmentPath(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (string, error) {
	return "", nil
}

func TestHandler_GetGlobalTasks(t *testing.T) {
	svc := &mockService{
		tasks: []Response{
			{ID: "task-1", Title: "Task 1"},
		},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	req := httptest.NewRequest("GET", "/tasks?exclude_buckets=done,archive", nil)
	w := httptest.NewRecorder()

	h.GetGlobalTasks(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var res []Response
	_ = json.NewDecoder(w.Body).Decode(&res)
	if len(res) != 1 || res[0].ID != "task-1" {
		t.Errorf("GetGlobalTasks response mismatch: %+v", res)
	}
}

func TestHandler_GetProjectTasks(t *testing.T) {
	svc := &mockService{
		tasks: []Response{
			{ID: "task-1", Title: "Task 1"},
		},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Get("/projects/{project_id}/tasks", h.GetProjectTasks)

	req := httptest.NewRequest("GET", "/projects/test-proj/tasks?bucket=todo&exclude_bucket=done&priorities=high", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_CreateTask(t *testing.T) {
	svc := &mockService{
		createRes: &Response{ID: "task-1", Title: "New Task"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Post("/projects/{project_id}/tasks", h.CreateTask)

	payload := Create{Title: "New Task", Bucket: "todo"}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/projects/test-proj/tasks", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}
}

func TestHandler_GetTaskByID(t *testing.T) {
	svc := &mockService{
		task: &Response{ID: "task-1", Title: "Test Task"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Get("/projects/{project_id}/tasks/{task_id}", h.GetTaskByID)

	req := httptest.NewRequest("GET", "/projects/test-proj/tasks/task-1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_UpdateTask(t *testing.T) {
	svc := &mockService{
		updateRes: &Response{ID: "task-1", Title: "Updated Task"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Put("/projects/{project_id}/tasks/{task_id}", h.UpdateTask)

	newTitle := "Updated Task"
	payload := Update{Title: &newTitle}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("PUT", "/projects/test-proj/tasks/task-1", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_DeleteTask(t *testing.T) {
	svc := &mockService{}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Delete("/projects/{project_id}/tasks/{task_id}", h.DeleteTask)

	req := httptest.NewRequest("DELETE", "/projects/test-proj/tasks/task-1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_MoveTask(t *testing.T) {
	svc := &mockService{
		moveRes: &Response{ID: "task-1", Bucket: "done"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Patch("/projects/{project_id}/tasks/{task_id}/move", h.MoveTask)

	payload := Move{Bucket: "done", Position: 1500.0}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("PATCH", "/projects/test-proj/tasks/task-1/move", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestRegisterRoutes(t *testing.T) {
	r := chi.NewRouter()
	RegisterRoutes(r, "test_dir")
}
