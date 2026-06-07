package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"gopkg.in/yaml.v3"
)

type UserConfig struct {
	DataDir  string `yaml:"data_dir" json:"data_dir"`
	Host     string `yaml:"host" json:"host"`
	Port     int    `yaml:"port" json:"port"`
	LogLevel string `yaml:"log_level" json:"log_level"`
}

var cachedConfig *UserConfig
var loadedConfigPath string

func LoadedConfigPath() string {
	return loadedConfigPath
}

func DefaultConfigPaths() []string {
	var paths []string

	// 1. Portable Mode Search (CWD, parent, executable directory)
	cwd, _ := os.Getwd()
	localDirs := []string{cwd}
	if cwd != "" {
		localDirs = append(localDirs, filepath.Dir(cwd))
	}
	if exe, err := os.Executable(); err == nil {
		localDirs = append(localDirs, filepath.Dir(exe))
	}

	for _, dir := range localDirs {
		if dir == "" {
			continue
		}
		for _, name := range []string{"jotter.yaml", "jotter.yml", "jotter.json"} {
			paths = append(paths, filepath.Join(dir, name))
		}
	}

	// 2. OS-Specific Global Config Directory Search
	if configDir, err := os.UserConfigDir(); err == nil {
		for _, name := range []string{"config.yaml", "config.yml", "config.json", "jotter.yaml", "jotter.yml", "jotter.json"} {
			paths = append(paths, filepath.Join(configDir, "jotter", name))
		}
	}

	return paths
}

func DefaultDataDir() string {
	// 1. Portable Mode: Check if a "tasks" directory already exists in the CWD
	cwd, err := os.Getwd()
	if err == nil {
		localTasks := filepath.Join(cwd, "tasks")
		if fi, err := os.Stat(localTasks); err == nil && fi.IsDir() {
			return localTasks
		}
	}

	// 2. Resolve OS-Specific Paths
	home, err := os.UserHomeDir()
	if err != nil {
		// Fallback to CWD/tasks if home directory cannot be resolved
		return filepath.Join(cwd, "tasks")
	}

	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(appData, "Jotter")
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Jotter")
	default: // Linux / Unix
		xdgData := os.Getenv("XDG_DATA_HOME")
		if xdgData != "" {
			return filepath.Join(xdgData, "jotter")
		}
		return filepath.Join(home, ".local", "share", "jotter")
	}
}

func DefaultConfigFilePath() string {
	cwd, err := os.Getwd()
	if err == nil {
		localTasks := filepath.Join(cwd, "tasks")
		if fi, err := os.Stat(localTasks); err == nil && fi.IsDir() {
			return filepath.Join(cwd, "jotter.yaml")
		}
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		if cwd != "" {
			return filepath.Join(cwd, "jotter.yaml")
		}
		return "jotter.yaml"
	}
	return filepath.Join(configDir, "jotter", "jotter.yaml")
}

func GetConfig(configPathFlag string) *UserConfig {
	if cachedConfig != nil {
		return cachedConfig
	}

	cfg := &UserConfig{}
	var foundPath string
	loadedConfigPath = ""

	if configPathFlag != "" {
		if _, err := os.Stat(configPathFlag); err == nil {
			foundPath = configPathFlag
		}
	} else {
		// Search default configuration files in priority order (local first, then OS standard)
		paths := DefaultConfigPaths()
		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				foundPath = path
				break
			}
		}

		// Create default config file if none exists
		if foundPath == "" {
			defaultPath := DefaultConfigFilePath()
			if err := os.MkdirAll(filepath.Dir(defaultPath), 0755); err == nil {
				content := `# Jotter Configuration File
# data_dir: ""
# host: "127.0.0.1"
# port: 58271
# log_level: "INFO"
`
				if err := os.WriteFile(defaultPath, []byte(content), 0644); err == nil {
					log.Printf("Created default configuration file at '%s'", defaultPath)
					foundPath = defaultPath
				}
			}
		}
	}

	if foundPath != "" {
		data, err := os.ReadFile(foundPath)
		if err == nil {
			if strings.HasSuffix(foundPath, ".json") {
				_ = json.Unmarshal(data, cfg)
			} else {
				_ = yaml.Unmarshal(data, cfg)
			}
			log.Printf("Loaded configuration from '%s'", foundPath)
			loadedConfigPath = foundPath
		}
	}

	cachedConfig = cfg
	return cfg
}

func GetDataDir(configPathFlag string, cliDataDir string) string {
	// 1. CLI flag
	if cliDataDir != "" {
		abs, err := filepath.Abs(cliDataDir)
		if err == nil {
			return abs
		}
		return cliDataDir
	}

	// 2. Env Var
	if env := os.Getenv("JOTTER_DATA_DIR"); env != "" {
		abs, err := filepath.Abs(env)
		if err == nil {
			return abs
		}
		return env
	}

	// 3. Config file
	cfg := GetConfig(configPathFlag)
	if cfg.DataDir != "" {
		abs, err := filepath.Abs(cfg.DataDir)
		if err == nil {
			return abs
		}
		return cfg.DataDir
	}

	// 4. Default: OS-specific standard directories (with local CWD portable mode fallback)
	return DefaultDataDir()
}

func GetDBPath(configPathFlag string, cliDataDir string) string {
	dataDir := GetDataDir(configPathFlag, cliDataDir)
	return filepath.Join(dataDir, "tasks.db")
}

func GetLogLevel(configPathFlag string) string {
	if env := os.Getenv("JOTTER_LOG_LEVEL"); env != "" {
		return strings.ToUpper(env)
	}

	cfg := GetConfig(configPathFlag)
	if cfg.LogLevel != "" {
		return strings.ToUpper(cfg.LogLevel)
	}

	// Default: INFO in local development (if go.mod is present in CWD), WARNING in production
	cwd, _ := os.Getwd()
	if _, err := os.Stat(filepath.Join(cwd, "go.mod")); err == nil {
		return "INFO"
	}
	return "WARNING"
}
