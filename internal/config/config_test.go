package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetDataDir(t *testing.T) {
	// Reset environment and cache
	os.Unsetenv("JOTTER_DATA_DIR")
	cachedConfig = nil

	t.Run("Default", func(t *testing.T) {
		cwd, _ := os.Getwd()
		expected := filepath.Join(cwd, "tasks")
		if res := GetDataDir("", ""); res != expected {
			t.Errorf("Expected %s, got %s", expected, res)
		}
	})

	t.Run("CLI Flag", func(t *testing.T) {
		expected := "/tmp/jotter-cli"
		if res := GetDataDir("", expected); res != expected {
			t.Errorf("Expected %s, got %s", expected, res)
		}
	})

	t.Run("Env Var", func(t *testing.T) {
		expected := "/tmp/jotter-env"
		os.Setenv("JOTTER_DATA_DIR", expected)
		defer os.Unsetenv("JOTTER_DATA_DIR")
		if res := GetDataDir("", ""); res != expected {
			t.Errorf("Expected %s, got %s", expected, res)
		}
	})
}

func TestGetLogLevel(t *testing.T) {
	origCwd, _ := os.Getwd()
	defer os.Chdir(origCwd)

	tempDir, _ := os.MkdirTemp("", "log-level-test-*")
	defer os.RemoveAll(tempDir)
	os.Chdir(tempDir)

	os.Unsetenv("JOTTER_LOG_LEVEL")
	cachedConfig = nil

	t.Run("Production (No go.mod)", func(t *testing.T) {
		if res := GetLogLevel(""); res != "WARNING" {
			t.Errorf("Expected WARNING, got %s", res)
		}
	})

	t.Run("Development (With go.mod)", func(t *testing.T) {
		os.WriteFile("go.mod", []byte("module test"), 0644)
		if res := GetLogLevel(""); res != "INFO" {
			t.Errorf("Expected INFO, got %s", res)
		}
		os.Remove("go.mod")
	})

	t.Run("Env Var", func(t *testing.T) {
		os.Setenv("JOTTER_LOG_LEVEL", "DEBUG")
		defer os.Unsetenv("JOTTER_LOG_LEVEL")
		if res := GetLogLevel(""); res != "DEBUG" {
			t.Errorf("Expected DEBUG, got %s", res)
		}
	})
}

func TestGetConfig(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "config-test-*")
	defer os.RemoveAll(tempDir)

	configPath := filepath.Join(tempDir, "jotter.yaml")
	os.WriteFile(configPath, []byte("port: 9999\nlog_level: ERROR"), 0644)

	t.Run("Custom Path", func(t *testing.T) {
		cachedConfig = nil
		cfg := GetConfig(configPath)
		if cfg.Port != 9999 {
			t.Errorf("Expected port 9999, got %d", cfg.Port)
		}
		if cfg.LogLevel != "ERROR" {
			t.Errorf("Expected log_level ERROR, got %s", cfg.LogLevel)
		}
	})
}
