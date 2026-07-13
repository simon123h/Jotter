package bucket

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

type mockService struct {
	buckets    []Response
	getErr     error
	createRes  *Response
	createErr  error
	updateRes  *Response
	updateErr  error
	deleteErr  error
	getCalled  bool
	createCall bool
	updateCall bool
	deleteCall bool
}

func (m *mockService) GetBuckets(ctx context.Context, projectID string) ([]Response, error) {
	m.getCalled = true
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.buckets, nil
}

func (m *mockService) CreateBucket(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error) {
	m.createCall = true
	if m.createErr != nil {
		return nil, m.createErr
	}
	return m.createRes, nil
}

func (m *mockService) UpdateBucket(ctx context.Context, tasksDir string, projectID string, name string, req Update) (*Response, error) {
	m.updateCall = true
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	return m.updateRes, nil
}

func (m *mockService) DeleteBucket(ctx context.Context, tasksDir string, projectID string, name string) error {
	m.deleteCall = true
	if m.deleteErr != nil {
		return m.deleteErr
	}
	return nil
}

func TestHandler_GetBuckets_Success(t *testing.T) {
	svc := &mockService{
		buckets: []Response{
			{Name: "todo", Title: "To Do"},
		},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Get("/projects/{project_id}/buckets", h.GetBuckets)

	req := httptest.NewRequest("GET", "/projects/test-proj/buckets", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var res []Response
	_ = json.NewDecoder(w.Body).Decode(&res)
	if len(res) != 1 || res[0].Name != "todo" {
		t.Errorf("GetBuckets response mismatch: %+v", res)
	}
}

func TestHandler_GetBuckets_NotFound(t *testing.T) {
	svc := &mockService{
		getErr: ErrProjectNotFound,
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Get("/projects/{project_id}/buckets", h.GetBuckets)

	req := httptest.NewRequest("GET", "/projects/non-existent/buckets", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestHandler_CreateBucket_Success(t *testing.T) {
	svc := &mockService{
		createRes: &Response{Name: "review", Title: "Review"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Post("/projects/{project_id}/buckets", h.CreateBucket)

	payload := Create{Title: "Review"}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/projects/test-proj/buckets", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}
}

func TestHandler_CreateBucket_Duplicate(t *testing.T) {
	svc := &mockService{
		createErr: ErrDuplicateBucket,
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Post("/projects/{project_id}/buckets", h.CreateBucket)

	payload := Create{Title: "Review"}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/projects/test-proj/buckets", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandler_UpdateBucket_Success(t *testing.T) {
	svc := &mockService{
		updateRes: &Response{Name: "todo", Title: "To Do Updated"},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Put("/projects/{project_id}/buckets/{name}", h.UpdateBucket)

	newTitle := "To Do Updated"
	payload := Update{Title: &newTitle}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("PUT", "/projects/test-proj/buckets/todo", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_DeleteBucket_Success(t *testing.T) {
	svc := &mockService{}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Delete("/projects/{project_id}/buckets/{name}", h.DeleteBucket)

	req := httptest.NewRequest("DELETE", "/projects/test-proj/buckets/todo", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_DeleteBucket_NotEmpty(t *testing.T) {
	svc := &mockService{
		deleteErr: ErrBucketNotEmpty,
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	r := chi.NewRouter()
	r.Delete("/projects/{project_id}/buckets/{name}", h.DeleteBucket)

	req := httptest.NewRequest("DELETE", "/projects/test-proj/buckets/todo", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestRegisterRoutes(t *testing.T) {
	r := chi.NewRouter()
	RegisterRoutes(r, "test_dir")
}
