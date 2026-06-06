package task

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

func GetTaskFilePath(tasksDir string, taskID string) (filePath string, filename string, projectID string, err error) {
	ulidFilename := fmt.Sprintf("%s.md", taskID)
	var prefixPadded, prefixLegacy string

	if taskInt, errConv := strconv.Atoi(taskID); errConv == nil {
		prefixPadded = fmt.Sprintf("%06d-", taskInt)
		prefixLegacy = fmt.Sprintf("%d-", taskInt)
	}

	searchInDir := func(directory string) (string, string, bool) {
		// 1. Direct match
		direct := filepath.Join(directory, ulidFilename)
		if fi, errStat := os.Stat(direct); errStat == nil && !fi.IsDir() {
			return direct, ulidFilename, true
		}

		// 2. Case-insensitive direct check
		entries, errRead := os.ReadDir(directory)
		if errRead != nil {
			return "", "", false
		}

		lowerUlid := strings.ToLower(ulidFilename)
		for _, entry := range entries {
			if strings.ToLower(entry.Name()) == lowerUlid && !entry.IsDir() {
				return filepath.Join(directory, entry.Name()), entry.Name(), true
			}
		}

		// 3. Legacy prefix check
		if prefixPadded != "" || prefixLegacy != "" {
			for _, entry := range entries {
				if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
					continue
				}
				if (prefixPadded != "" && strings.HasPrefix(entry.Name(), prefixPadded)) ||
					(prefixLegacy != "" && strings.HasPrefix(entry.Name(), prefixLegacy)) {
					return filepath.Join(directory, entry.Name()), entry.Name(), true
				}
			}
		}
		return "", "", false
	}

	// Search in subdirectories
	entries, errRead := os.ReadDir(tasksDir)
	if errRead == nil {
		for _, entry := range entries {
			if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
				subDir := filepath.Join(tasksDir, entry.Name())
				if fp, fn, ok := searchInDir(subDir); ok {
					return fp, fn, entry.Name(), nil
				}
			}
		}
	}

	return "", "", "", errors.New("task file not found")
}

func ReadTaskFile(tasksDir string, taskID string) (*Response, error) {
	filePath, _, projectID, err := GetTaskFilePath(tasksDir, taskID)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	fm, body, err := ParseFrontmatter(string(data))
	if err != nil {
		return nil, err
	}

	return &Response{
		ID:          taskID,
		ProjectID:   projectID,
		Title:       fm.Title,
		Bucket:      fm.Bucket,
		Position:    fm.Position,
		Tags:        fm.Tags,
		Attachments: fm.Attachments,
		Body:        body,
		DueDate:     fm.DueDate,
		PlannedDate: fm.PlannedDate,
		Priority:    fm.Priority,
		Color:       fm.Color,
		CreatedAt:   fm.CreatedAt,
		UpdatedAt:   fm.UpdatedAt,
	}, nil
}

func WriteTaskFile(tasksDir string, taskID string, taskData map[string]interface{}) (string, error) {
	projectID, ok := taskData["project_id"].(string)
	if !ok {
		projectID = "default"
	}
	projectDir := filepath.Join(tasksDir, projectID)
	_ = os.MkdirAll(projectDir, 0755)

	newFilename := fmt.Sprintf("%s.md", taskID)
	newFilePath := filepath.Join(projectDir, newFilename)

	oldFilePath, _, _, errFilePath := GetTaskFilePath(tasksDir, taskID)

	var tags, attachments []string
	if rawTags, exists := taskData["tags"]; exists {
		if tagsSlice, okSlice := rawTags.([]string); okSlice {
			tags = tagsSlice
		}
	}
	if rawAtt, exists := taskData["attachments"]; exists {
		if attSlice, okSlice := rawAtt.([]string); okSlice {
			attachments = attSlice
		}
	}

	var dueDate, plannedDate, priority, color *string
	if val, okVal := taskData["due_date"].(*string); okVal {
		dueDate = val
	} else if val, okVal := taskData["due_date"].(string); okVal && val != "" {
		dueDate = &val
	}

	if val, okVal := taskData["planned_date"].(*string); okVal {
		plannedDate = val
	} else if val, okVal := taskData["planned_date"].(string); okVal && val != "" {
		plannedDate = &val
	}

	if val, okVal := taskData["priority"].(*string); okVal {
		priority = val
	} else if val, okVal := taskData["priority"].(string); okVal && val != "" {
		priority = &val
	}

	if val, okVal := taskData["color"].(*string); okVal {
		color = val
	} else if val, okVal := taskData["color"].(string); okVal && val != "" {
		color = &val
	}

	fm := Frontmatter{
		ID:          taskID,
		ProjectID:   projectID,
		Title:       taskData["title"].(string),
		Bucket:      taskData["bucket"].(string),
		Position:    taskData["position"].(float64),
		Tags:        tags,
		Attachments: attachments,
		DueDate:     dueDate,
		PlannedDate: plannedDate,
		Priority:    priority,
		Color:       color,
		CreatedAt:   taskData["created_at"].(string),
		UpdatedAt:   taskData["updated_at"].(string),
	}

	body, _ := taskData["body"].(string)
	fileContent, errDump := DumpFrontmatter(&fm, body)
	if errDump != nil {
		return "", errDump
	}

	// Atomic write
	tempFile, errTemp := os.CreateTemp(projectDir, "task-*.tmp")
	if errTemp != nil {
		return "", errTemp
	}
	defer func() {
		_ = tempFile.Close()
		_ = os.Remove(tempFile.Name())
	}()

	if _, errWrite := tempFile.WriteString(fileContent); errWrite != nil {
		return "", errWrite
	}
	_ = tempFile.Close()

	if errRename := os.Rename(tempFile.Name(), newFilePath); errRename != nil {
		return "", errRename
	}

	// If project directory changed, move the attachments folder too
	if errFilePath == nil && oldFilePath != newFilePath {
		oldProjectID := filepath.Base(filepath.Dir(oldFilePath))
		newProjectID := projectID

		if oldProjectID != newProjectID {
			oldAttachmentsDir := filepath.Join(tasksDir, oldProjectID, taskID+".attachments")
			newAttachmentsDir := filepath.Join(tasksDir, newProjectID, taskID+".attachments")
			if _, err := os.Stat(oldAttachmentsDir); err == nil {
				_ = os.Rename(oldAttachmentsDir, newAttachmentsDir)
			}
		}

		_ = os.Remove(oldFilePath)
	}

	return newFilename, nil
}

func DeleteTaskFile(tasksDir string, taskID string) bool {
	filePath, _, projectID, err := GetTaskFilePath(tasksDir, taskID)
	if err == nil {
		if errDel := os.Remove(filePath); errDel == nil {
			// Delete attachments folder too
			attachmentsDir := filepath.Join(tasksDir, projectID, taskID+".attachments")
			_ = os.RemoveAll(attachmentsDir)
			return true
		}
	}
	return false
}

func ParseFrontmatter(content string) (*Frontmatter, string, error) {
	lines := strings.Split(content, "\n")
	if len(lines) < 2 || strings.TrimSpace(lines[0]) != "---" {
		return nil, "", errors.New("invalid frontmatter: missing start separator")
	}

	yamlEnd := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			yamlEnd = i
			break
		}
	}

	if yamlEnd == -1 {
		return nil, "", errors.New("invalid frontmatter: missing end separator")
	}

	yamlBlock := strings.Join(lines[1:yamlEnd], "\n")
	body := strings.Join(lines[yamlEnd+1:], "\n")

	var fm Frontmatter
	if err := yaml.Unmarshal([]byte(yamlBlock), &fm); err != nil {
		return nil, "", err
	}

	// Lowercase tags for consistency
	for i, tag := range fm.Tags {
		fm.Tags[i] = strings.ToLower(tag)
	}

	return &fm, body, nil
}

func DumpFrontmatter(fm *Frontmatter, body string) (string, error) {
	yamlBytes, err := yaml.Marshal(fm)
	if err != nil {
		return "", err
	}
	return "---\n" + string(yamlBytes) + "---\n" + body, nil
}
