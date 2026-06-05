package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	IsProduction = false // Set to true for compiled releases
)

type UserConfig struct {
	DataDir  string `yaml:"data_dir" json:"data_dir"`
	Host     string `yaml:"host" json:"host"`
	Port     int    `yaml:"port" json:"port"`
	LogLevel string `yaml:"log_level" json:"log_level"`
}

var cachedConfig *UserConfig

func init() {
	// Simple auto-detection: check if running from a tmp directory or if some production indicators are met
	if exePath, err := os.Executable(); err == nil {
		if strings.Contains(exePath, "AppImage") || strings.Contains(exePath, "tmp") {
			IsProduction = true
		}
	}
}

func GetConfig(configPathFlag string) *UserConfig {
	if cachedConfig != nil {
		return cachedConfig
	}

	cfg := &UserConfig{}
	var foundPath string

	if configPathFlag != "" {
		if _, err := os.Stat(configPathFlag); err == nil {
			foundPath = configPathFlag
		}
	} else {
		// Search default configuration files in CWD, CWD's parent, and executable parent directory
		cwd, _ := os.Getwd()
		searchDirs := []string{cwd}
		if cwd != "" {
			searchDirs = append(searchDirs, filepath.Dir(cwd))
		}
		if exe, err := os.Executable(); err == nil {
			searchDirs = append(searchDirs, filepath.Dir(exe))
		}

		for _, dir := range searchDirs {
			for _, name := range []string{"jotter.yaml", "jotter.yml", "jotter.json"} {
				path := filepath.Join(dir, name)
				if _, err := os.Stat(path); err == nil {
					foundPath = path
					break
				}
			}
			if foundPath != "" {
				break
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

	// 4. Default
	cwd, _ := os.Getwd()
	if IsProduction {
		return filepath.Join(cwd, "tasks")
	}
	// Dev mode default (parent of backend folder)
	exe, _ := os.Executable()
	return filepath.Clean(filepath.Join(filepath.Dir(exe), "..", "tasks"))
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

	if IsProduction {
		return "WARNING"
	}
	return "INFO"
}
