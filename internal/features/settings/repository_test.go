package settings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSettings_Defaults(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "settings-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	repo := NewFileRepository()

	// 1. Loading settings when file does not exist should create it with defaults
	s, err := repo.LoadSettings(tempDir)
	if err != nil {
		t.Fatalf("Unexpected error loading settings: %v", err)
	}

	if s.CurrentTheme != "nordic-light" {
		t.Errorf("Expected theme nordic-light, got %s", s.CurrentTheme)
	}

	// Verify file was created
	settingsFile := filepath.Join(tempDir, "settings.json")
	if _, err := os.Stat(settingsFile); os.IsNotExist(err) {
		t.Errorf("Expected settings.json to be created, but it does not exist")
	}
}

func TestLoadAndSaveSettings(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "settings-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	repo := NewFileRepository()

	// Load initial
	s, err := repo.LoadSettings(tempDir)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Modify
	s.CurrentTheme = "nordic-dark"
	s.HideDoneColumn = false
	s.TagColors = map[string]string{
		"urgent": "#ff0000",
	}

	// Save
	err = repo.SaveSettings(tempDir, s)
	if err != nil {
		t.Fatalf("Failed to save settings: %v", err)
	}

	// Re-load to verify
	s2, err := repo.LoadSettings(tempDir)
	if err != nil {
		t.Fatalf("Failed to re-load settings: %v", err)
	}

	if s2.CurrentTheme != "nordic-dark" || s2.HideDoneColumn != false {
		t.Errorf("Modified settings mismatch: %+v", s2)
	}
	if color, ok := s2.TagColors["urgent"]; !ok || color != "#ff0000" {
		t.Errorf("Tag colors mismatch: %+v", s2.TagColors)
	}
}
