package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

type mockService struct {
	settings   AppSettings
	getErr     error
	saveErr    error
	getCalled  bool
	saveCalled bool
}

func (m *mockService) GetSettings(ctx context.Context, tasksDir string) (AppSettings, error) {
	m.getCalled = true
	if m.getErr != nil {
		return AppSettings{}, m.getErr
	}
	return m.settings, nil
}

func (m *mockService) SaveSettings(ctx context.Context, tasksDir string, settings AppSettings) error {
	m.saveCalled = true
	if m.saveErr != nil {
		return m.saveErr
	}
	m.settings = settings
	return nil
}

func TestHandler_GetSettings_Success(t *testing.T) {
	svc := &mockService{
		settings: AppSettings{
			CurrentTheme: "nordic-light",
		},
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	req := httptest.NewRequest("GET", "/settings", nil)
	w := httptest.NewRecorder()

	h.GetSettings(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var res AppSettings
	if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if res.CurrentTheme != "nordic-light" {
		t.Errorf("Expected Nordic light theme, got %s", res.CurrentTheme)
	}
}

func TestHandler_GetSettings_Error(t *testing.T) {
	svc := &mockService{
		getErr: errors.New("read error"),
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	req := httptest.NewRequest("GET", "/settings", nil)
	w := httptest.NewRecorder()

	h.GetSettings(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", w.Code)
	}
}

func TestHandler_SaveSettings_Success(t *testing.T) {
	svc := &mockService{}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	s := AppSettings{
		CurrentTheme: "nordic-dark",
	}
	body, _ := json.Marshal(s)
	req := httptest.NewRequest("POST", "/settings", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.SaveSettings(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	if !svc.saveCalled {
		t.Error("Expected SaveSettings to be called on service")
	}

	if svc.settings.CurrentTheme != "nordic-dark" {
		t.Errorf("Expected Nordic dark theme, got %s", svc.settings.CurrentTheme)
	}
}

func TestHandler_SaveSettings_InvalidJSON(t *testing.T) {
	svc := &mockService{}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	req := httptest.NewRequest("POST", "/settings", bytes.NewBufferString("{invalid json"))
	w := httptest.NewRecorder()

	h.SaveSettings(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestHandler_SaveSettings_Error(t *testing.T) {
	svc := &mockService{
		saveErr: errors.New("write error"),
	}
	h := &Handler{svc: svc, tasksDir: "test_dir"}

	s := AppSettings{
		CurrentTheme: "nordic-dark",
	}
	body, _ := json.Marshal(s)
	req := httptest.NewRequest("POST", "/settings", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.SaveSettings(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", w.Code)
	}
}

func TestRegisterRoutes(t *testing.T) {
	r := chi.NewRouter()
	RegisterRoutes(r, "test_dir")
}
