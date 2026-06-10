package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// FileRepository defines the disk operations for settings
type FileRepository interface {
	LoadSettings(tasksDir string) (AppSettings, error)
	SaveSettings(tasksDir string, settings AppSettings) error
}

type fileRepository struct{}

// NewFileRepository creates a new File repository instance for settings
func NewFileRepository() FileRepository {
	return &fileRepository{}
}

func (r *fileRepository) LoadSettings(tasksDir string) (AppSettings, error) {
	return LoadSettings(tasksDir)
}

func (r *fileRepository) SaveSettings(tasksDir string, settings AppSettings) error {
	return SaveSettings(tasksDir, settings)
}

// Low-level helper functions (Kept for backwards compatibility and internal repository usage)

type AppSettings struct {
	HideDoneColumn    bool              `json:"hideDoneColumn"`
	HideArchiveColumn bool              `json:"hideArchiveColumn"`
	IsSidebarOpen     bool              `json:"isSidebarOpen"`
	CurrentTheme      string            `json:"currentTheme"`
	ThresholdDays     int               `json:"thresholdDays"`
	PinnedProjectIds  []string          `json:"pinnedProjectIds"`
	SortBy            string            `json:"sortBy"`
	HideAddTaskButton bool              `json:"hideAddTaskButton"`
	ProjectOrder      []string          `json:"projectOrder"`
	WindowWidth       int               `json:"windowWidth"`
	WindowHeight      int               `json:"windowHeight"`
	WindowX           int               `json:"windowX"`
	WindowY           int               `json:"windowY"`
	WindowMaximized   bool              `json:"windowMaximized"`
	GitRemoteURL      string            `json:"gitRemoteUrl"`
	Language          string            `json:"language"`
	TagColors         map[string]string `json:"tagColors"`
}

func GetDefaultSettings() AppSettings {
	return AppSettings{
		HideDoneColumn:    true,
		HideArchiveColumn: true,
		IsSidebarOpen:     true,
		CurrentTheme:      "nordic-light",
		ThresholdDays:     7,
		PinnedProjectIds:  []string{},
		SortBy:            "alpha",
		HideAddTaskButton: true,
		ProjectOrder:      []string{},
		WindowWidth:       1024,
		WindowHeight:      768,
		WindowX:           -1,
		WindowY:           -1,
		WindowMaximized:   true,
		GitRemoteURL:      "",
		Language:          "",
		TagColors:         map[string]string{},
	}
}

func LoadSettings(tasksDir string) (AppSettings, error) {
	settingsFile := filepath.Join(tasksDir, "settings.json")
	if _, err := os.Stat(settingsFile); os.IsNotExist(err) {
		defaults := GetDefaultSettings()
		err := SaveSettings(tasksDir, defaults)
		return defaults, err
	}

	data, err := os.ReadFile(settingsFile)
	if err != nil {
		return GetDefaultSettings(), err
	}

	// Initialize with defaults to merge missing fields (forward compatibility)
	settings := GetDefaultSettings()
	if err := json.Unmarshal(data, &settings); err != nil {
		return GetDefaultSettings(), err
	}

	if settings.ProjectOrder == nil {
		settings.ProjectOrder = []string{}
	}
	if settings.PinnedProjectIds == nil {
		settings.PinnedProjectIds = []string{}
	}
	if settings.TagColors == nil {
		settings.TagColors = map[string]string{}
	}

	return settings, nil
}

func SaveSettings(tasksDir string, settings AppSettings) error {
	settingsFile := filepath.Join(tasksDir, "settings.json")
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	// Make sure data directory exists
	if err := os.MkdirAll(tasksDir, 0755); err != nil {
		return err
	}

	// Atomic write
	tmpFile := settingsFile + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpFile, settingsFile)
}
