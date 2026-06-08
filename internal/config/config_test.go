package config

import (
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestMain(m *testing.M) {
	// Isolate tests from the user's real home directory and standard paths
	tempHome, err := os.MkdirTemp("", "jotter-test-home-*")
	if err != nil {
		log.Fatalf("Failed to create test home: %v", err)
	}
	defer os.RemoveAll(tempHome)

	// Save original env vars
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")
	origXdgConfig := os.Getenv("XDG_CONFIG_HOME")
	origXdgData := os.Getenv("XDG_DATA_HOME")
	origAppData := os.Getenv("APPDATA")

	// Set env vars to tempHome
	os.Setenv("HOME", tempHome)
	os.Setenv("USERPROFILE", tempHome)
	os.Setenv("XDG_CONFIG_HOME", filepath.Join(tempHome, ".config"))
	os.Setenv("XDG_DATA_HOME", filepath.Join(tempHome, ".local", "share"))
	os.Setenv("APPDATA", filepath.Join(tempHome, "AppData", "Roaming"))

	code := m.Run()

	// Restore original env vars
	os.Setenv("HOME", origHome)
	os.Setenv("USERPROFILE", origUserProfile)
	os.Setenv("XDG_CONFIG_HOME", origXdgConfig)
	os.Setenv("XDG_DATA_HOME", origXdgData)
	os.Setenv("APPDATA", origAppData)

	os.Exit(code)
}

func TestDefaultDataDir(t *testing.T) {
	origCwd, _ := os.Getwd()
	defer os.Chdir(origCwd)

	tempDir, err := os.MkdirTemp("", "jotter-data-dir-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	err = os.Chdir(tempDir)
	if err != nil {
		t.Fatalf("Failed to change dir: %v", err)
	}

	t.Run("OS-Specific Default (tasks directory does not exist)", func(t *testing.T) {
		res := DefaultDataDir()

		// It should not be CWD/tasks because the directory does not exist
		localTasks := filepath.Join(tempDir, "tasks")
		if res == localTasks {
			t.Errorf("Expected OS-specific standard directory, but got CWD/tasks: %s", res)
		}

		// Ensure it maps to the correct OS-specific suffix
		var expectedSuffix string
		switch runtime.GOOS {
		case "windows":
			expectedSuffix = "Jotter"
		case "darwin":
			expectedSuffix = filepath.Join("Library", "Application Support", "Jotter")
		default:
			expectedSuffix = filepath.Join(".local", "share", "jotter")
		}

		if !filepath.HasPrefix(res, "/") && runtime.GOOS != "windows" {
			t.Errorf("Expected absolute path, got: %s", res)
		}
		if !filepath.IsAbs(res) {
			t.Errorf("Expected absolute path, got: %s", res)
		}
		if !strings.HasSuffix(res, expectedSuffix) && !strings.Contains(res, "Jotter") && !strings.Contains(res, "jotter") {
			t.Errorf("Expected path ending with %s, got: %s", expectedSuffix, res)
		}
	})

	t.Run("Portable Mode Fallback (tasks directory exists)", func(t *testing.T) {
		localTasks := filepath.Join(tempDir, "tasks")
		err := os.Mkdir(localTasks, 0755)
		if err != nil {
			t.Fatalf("Failed to create tasks dir: %v", err)
		}
		defer os.Remove(localTasks)

		res := DefaultDataDir()
		if res != localTasks {
			t.Errorf("Expected portable fallback %s, got %s", localTasks, res)
		}
	})
}

func TestGetDataDir(t *testing.T) {
	// Reset environment and cache
	os.Unsetenv("JOTTER_DATA_DIR")
	cachedConfig = nil

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
		if LoadedConfigPath() != configPath {
			t.Errorf("Expected loaded config path %s, got %s", configPath, LoadedConfigPath())
		}
	})
}

func TestGetConfigDefaultCreation(t *testing.T) {
	// Ensure cache is cleared
	cachedConfig = nil

	defaultPath := DefaultConfigFilePath()
	// Ensure the file is not there initially
	_ = os.Remove(defaultPath)

	cfg := GetConfig("")
	if cfg == nil {
		t.Fatal("Expected GetConfig to return non-nil config")
	}

	// Verify that the file was created
	if _, err := os.Stat(defaultPath); os.IsNotExist(err) {
		t.Error("Expected default config file to be created, but it does not exist")
	}

	// Verify LoadedConfigPath returns the created path
	if LoadedConfigPath() != defaultPath {
		t.Errorf("Expected LoadedConfigPath to be %s, got %s", defaultPath, LoadedConfigPath())
	}

	// Clean up
	_ = os.Remove(defaultPath)
	cachedConfig = nil
}

func TestDefaultLogDir(t *testing.T) {
	res := DefaultLogDir()

	if !filepath.IsAbs(res) {
		t.Errorf("Expected absolute path, got: %s", res)
	}

	// Ensure it maps to standard OS directories or fallbacks
	var expectedSuffix string
	switch runtime.GOOS {
	case "windows":
		expectedSuffix = "Jotter"
	case "darwin":
		expectedSuffix = filepath.Join("Library", "Logs", "Jotter")
	default:
		expectedSuffix = filepath.Join(".cache", "jotter")
	}

	if !strings.HasSuffix(res, expectedSuffix) && !strings.Contains(res, "Jotter") && !strings.Contains(res, "jotter") {
		t.Errorf("Expected path ending with %s, got: %s", expectedSuffix, res)
	}
}

func TestGetLogDir(t *testing.T) {
	// Reset environment and cache
	os.Unsetenv("JOTTER_LOG_DIR")
	cachedConfig = nil

	t.Run("Env Var Override", func(t *testing.T) {
		expected := "/tmp/jotter-log-env"
		os.Setenv("JOTTER_LOG_DIR", expected)
		defer os.Unsetenv("JOTTER_LOG_DIR")
		if res := GetLogDir(""); res != expected {
			t.Errorf("Expected %s, got %s", expected, res)
		}
	})

	t.Run("Config Override", func(t *testing.T) {
		tempDir, _ := os.MkdirTemp("", "log-config-test-*")
		defer os.RemoveAll(tempDir)

		configPath := filepath.Join(tempDir, "jotter.yaml")
		expected := "/tmp/jotter-log-cfg"
		os.WriteFile(configPath, []byte("log_dir: "+expected), 0644)

		cachedConfig = nil
		if res := GetLogDir(configPath); res != expected {
			t.Errorf("Expected %s, got %s", expected, res)
		}
	})
}
