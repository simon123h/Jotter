package bucket

import (
	"encoding/json"
	"os"
	"path/filepath"
)

var DefaultBuckets = []map[string]interface{}{
	{"name": "backlog", "title": "Backlog", "subtitle": "", "position": 1000.0, "is_default": true, "layout": "list"},
	{"name": "todo", "title": "To Do", "subtitle": "", "position": 2000.0, "is_default": false, "layout": "list"},
	{"name": "in-progress", "title": "In Progress", "subtitle": "", "position": 3000.0, "is_default": false, "layout": "list"},
	{"name": "done", "title": "Done", "subtitle": "", "position": 4000.0, "is_default": false, "layout": "list"},
	{"name": "archive", "title": "Archive", "subtitle": "", "position": 5000.0, "is_default": false, "layout": "list"},
}

func LoadBucketsFile(tasksDir string, projectID string) ([]map[string]interface{}, error) {
	projectDir := filepath.Join(tasksDir, projectID)
	_ = os.MkdirAll(projectDir, 0755)
	bucketsFile := filepath.Join(projectDir, "buckets.json")

	if _, err := os.Stat(bucketsFile); os.IsNotExist(err) {
		if err := WriteBucketsFile(tasksDir, projectID, DefaultBuckets); err != nil {
			return nil, err
		}
		return DefaultBuckets, nil
	}

	data, err := os.ReadFile(bucketsFile)
	if err != nil {
		return nil, err
	}

	var buckets []map[string]interface{}
	if err := json.Unmarshal(data, &buckets); err != nil {
		return nil, err
	}

	// Ensure compatibility values
	for _, b := range buckets {
		if _, ok := b["subtitle"]; !ok {
			b["subtitle"] = ""
		}
		if _, ok := b["color"]; !ok {
			b["color"] = nil
		}
		if _, ok := b["layout"]; !ok {
			b["layout"] = "list"
		}
		if _, ok := b["max_tasks"]; !ok {
			b["max_tasks"] = nil
		}
	}
	return buckets, nil
}

func WriteBucketsFile(tasksDir string, projectID string, buckets []map[string]interface{}) error {
	projectDir := filepath.Join(tasksDir, projectID)
	_ = os.MkdirAll(projectDir, 0755)
	bucketsFile := filepath.Join(projectDir, "buckets.json")

	data, err := json.MarshalIndent(buckets, "", "  ")
	if err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(projectDir, "buckets-*.tmp")
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

	return os.Rename(tempFile.Name(), bucketsFile)
}
