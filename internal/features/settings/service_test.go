package settings

import (
	"context"
	"errors"
	"testing"
)

type mockFileRepository struct {
	settings   AppSettings
	loadErr    error
	saveErr    error
	loadCalled bool
	saveCalled bool
}

func (m *mockFileRepository) LoadSettings(tasksDir string) (AppSettings, error) {
	m.loadCalled = true
	if m.loadErr != nil {
		return AppSettings{}, m.loadErr
	}
	return m.settings, nil
}

func (m *mockFileRepository) SaveSettings(tasksDir string, settings AppSettings) error {
	m.saveCalled = true
	if m.saveErr != nil {
		return m.saveErr
	}
	m.settings = settings
	return nil
}

func TestGetSettings(t *testing.T) {
	mockRepo := &mockFileRepository{
		settings: AppSettings{
			CurrentTheme: "dark-blue",
			Language:     "en",
		},
	}
	svc := NewService(mockRepo)

	res, err := svc.GetSettings(context.Background(), "tasks_dir")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if !mockRepo.loadCalled {
		t.Error("Expected LoadSettings to be called on file repository")
	}

	if res.CurrentTheme != "dark-blue" || res.Language != "en" {
		t.Errorf("Result mismatch, got %+v", res)
	}
}

func TestSaveSettings(t *testing.T) {
	mockRepo := &mockFileRepository{}
	svc := NewService(mockRepo)

	s := AppSettings{
		CurrentTheme:  "nordic-light",
		ThresholdDays: 14,
	}

	err := svc.SaveSettings(context.Background(), "tasks_dir", s)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if !mockRepo.saveCalled {
		t.Error("Expected SaveSettings to be called on file repository")
	}

	if mockRepo.settings.CurrentTheme != "nordic-light" || mockRepo.settings.ThresholdDays != 14 {
		t.Errorf("Repo settings mismatch, got %+v", mockRepo.settings)
	}
}

func TestGetSettings_Failure(t *testing.T) {
	mockRepo := &mockFileRepository{
		loadErr: errors.New("read failed"),
	}
	svc := NewService(mockRepo)

	_, err := svc.GetSettings(context.Background(), "tasks_dir")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
}
