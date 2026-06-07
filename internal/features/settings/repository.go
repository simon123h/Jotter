package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type AppSettings struct {
	HideDoneColumn    bool             `json:"hideDoneColumn"`
	HideArchiveColumn bool             `json:"hideArchiveColumn"`
	IsSidebarOpen     bool             `json:"isSidebarOpen"`
	CurrentTheme      string           `json:"currentTheme"`
	ThresholdDays     int              `json:"thresholdDays"`
	PinnedProjectIds  []string         `json:"pinnedProjectIds"`
	SortBy            string           `json:"sortBy"`
	HideAddTaskButton bool             `json:"hideAddTaskButton"`
	ProjectMru        map[string]int64 `json:"projectMru"`
	WindowWidth       int              `json:"windowWidth"`
	WindowHeight      int              `json:"windowHeight"`
	WindowX           int              `json:"windowX"`
	WindowY           int              `json:"windowY"`
	WindowMaximized   bool             `json:"windowMaximized"`
	GitRemoteURL      string           `json:"gitRemoteUrl"`
	Language          string           `json:"language"`
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
		ProjectMru:        make(map[string]int64),
		WindowWidth:       1024,
		WindowHeight:      768,
		WindowX:           -1,
		WindowY:           -1,
		WindowMaximized:   true,
		GitRemoteURL:      "",
		Language:          "",
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

	if settings.ProjectMru == nil {
		settings.ProjectMru = make(map[string]int64)
	}
	if settings.PinnedProjectIds == nil {
		settings.PinnedProjectIds = []string{}
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
