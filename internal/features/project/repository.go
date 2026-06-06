package project

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func LoadProjectsFile(tasksDir string) ([]map[string]interface{}, error) {
	projectsFile := filepath.Join(tasksDir, "projects.json")
	if _, err := os.Stat(projectsFile); os.IsNotExist(err) {
		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)
		defaultProj := []map[string]interface{}{
			{
				"id":                "default",
				"title":             "Default Project",
				"created_at":        nowStr,
				"done_clean_period": nil,
				"git_remote":        nil,
			},
		}
		_ = os.MkdirAll(filepath.Join(tasksDir, "default"), 0755)
		if err := WriteProjectsFile(tasksDir, defaultProj); err != nil {
			return nil, err
		}
		return defaultProj, nil
	}

	data, err := os.ReadFile(projectsFile)
	if err != nil {
		return nil, err
	}

	var projects []map[string]interface{}
	if err := json.Unmarshal(data, &projects); err != nil {
		return nil, err
	}

	for _, p := range projects {
		if _, ok := p["done_clean_period"]; !ok {
			p["done_clean_period"] = nil
		}
		if _, ok := p["git_remote"]; !ok {
			p["git_remote"] = nil
		}
	}
	return projects, nil
}

func WriteProjectsFile(tasksDir string, projects []map[string]interface{}) error {
	projectsFile := filepath.Join(tasksDir, "projects.json")
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return err
	}

	// Atomic write
	tempFile, err := os.CreateTemp(tasksDir, "projects-*.tmp")
	if err != nil {
		return err
	}
	defer func() {
		_ = tempFile.Close()
		_ = os.Remove(tempFile.Name())
	}()

	if _, err := tempFile.Write(data); err != nil {
		return err
	}
	_ = tempFile.Close()

	return os.Rename(tempFile.Name(), projectsFile)
}

func DeleteProjectDir(tasksDir string, projectID string) error {
	projectDir := filepath.Join(tasksDir, projectID)
	return os.RemoveAll(projectDir)
}
