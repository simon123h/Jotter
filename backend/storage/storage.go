package storage

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"jotter/backend/db"
	"jotter/backend/models"
)

const base32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

func encodeBase32(value int64, length int) string {
	chars := make([]byte, length)
	for i := length - 1; i >= 0; i-- {
		chars[i] = base32Alphabet[value%32]
		value /= 32
	}
	return string(chars)
}

func encodeBase32Big(value *big.Int, length int) string {
	chars := make([]byte, length)
	temp := new(big.Int).Set(value)
	thirtyTwo := big.NewInt(32)
	rem := new(big.Int)

	for i := length - 1; i >= 0; i-- {
		temp.DivMod(temp, thirtyTwo, rem)
		chars[i] = base32Alphabet[rem.Int64()]
	}
	return string(chars)
}

func GenerateULID() string {
	nowMs := time.Now().UnixNano() / int64(time.Millisecond)
	randomBytes := make([]byte, 10)
	_, _ = rand.Read(randomBytes)

	tsStr := encodeBase32(nowMs, 10)

	var randVal big.Int
	randVal.SetBytes(randomBytes)

	randStr := encodeBase32Big(&randVal, 16)
	return tsStr + randStr
}

func Slugify(s string) string {
	s = strings.ToLower(s)
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			sb.WriteRune(r)
		} else if r == ' ' {
			sb.WriteRune('-')
		}
	}
	res := sb.String()
	for strings.Contains(res, "--") {
		res = strings.ReplaceAll(res, "--", "-")
	}
	return strings.Trim(res, "-_")
}

var DefaultBuckets = []map[string]interface{}{
	{"name": "backlog", "title": "Backlog", "subtitle": "", "position": 1000.0, "is_default": true, "layout": "list"},
	{"name": "todo", "title": "To Do", "subtitle": "", "position": 2000.0, "is_default": false, "layout": "list"},
	{"name": "in-progress", "title": "In Progress", "subtitle": "", "position": 3000.0, "is_default": false, "layout": "list"},
	{"name": "done", "title": "Done", "subtitle": "", "position": 4000.0, "is_default": false, "layout": "list"},
}

type TaskFrontmatter struct {
	ID        string   `yaml:"id"`
	ProjectID string   `yaml:"project_id"`
	Title     string   `yaml:"title"`
	Bucket    string   `yaml:"bucket"`
	Position  float64  `yaml:"position"`
	Tags      []string `yaml:"tags"`
	DueDate   *string  `yaml:"due_date"`
	Priority  *string  `yaml:"priority"`
	Color     *string  `yaml:"color"`
	CreatedAt string   `yaml:"created_at"`
	UpdatedAt string   `yaml:"updated_at"`
}

func LoadProjectsFile(tasksDir string) ([]map[string]interface{}, error) {
	projectsFile := filepath.Join(tasksDir, "projects.json")
	if _, err := os.Stat(projectsFile); os.IsNotExist(err) {
		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)
		defaultProj := []map[string]interface{}{
			{
				"id":                 "default",
				"title":              "Default Project",
				"created_at":         nowStr,
				"done_clean_period":  nil,
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

	// Search in root directory
	if fp, fn, ok := searchInDir(tasksDir); ok {
		return fp, fn, "default", nil
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

func ReadTaskFile(tasksDir string, taskID string) (*models.TaskResponse, error) {
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

	return &models.TaskResponse{
		ID:        taskID,
		ProjectID: projectID,
		Title:     fm.Title,
		Bucket:    fm.Bucket,
		Position:  fm.Position,
		Tags:      fm.Tags,
		Body:      body,
		DueDate:   fm.DueDate,
		Priority:  fm.Priority,
		Color:     fm.Color,
		CreatedAt: fm.CreatedAt,
		UpdatedAt: fm.UpdatedAt,
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

	var tags []string
	if rawTags, exists := taskData["tags"]; exists {
		if tagsSlice, okSlice := rawTags.([]string); okSlice {
			tags = tagsSlice
		}
	}

	var dueDate, priority, color *string
	if val, okVal := taskData["due_date"].(*string); okVal {
		dueDate = val
	} else if val, okVal := taskData["due_date"].(string); okVal && val != "" {
		dueDate = &val
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

	fm := TaskFrontmatter{
		ID:        taskID,
		ProjectID: projectID,
		Title:     taskData["title"].(string),
		Bucket:    taskData["bucket"].(string),
		Position:  taskData["position"].(float64),
		Tags:      tags,
		DueDate:   dueDate,
		Priority:  priority,
		Color:     color,
		CreatedAt: taskData["created_at"].(string),
		UpdatedAt: taskData["updated_at"].(string),
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

	// If project directory or filename changed, clean up the old file
	if errFilePath == nil && oldFilePath != newFilePath {
		_ = os.Remove(oldFilePath)
	}

	return newFilename, nil
}

func DeleteTaskFile(tasksDir string, taskID string) bool {
	filePath, _, _, err := GetTaskFilePath(tasksDir, taskID)
	if err == nil {
		if errDel := os.Remove(filePath); errDel == nil {
			return true
		}
	}
	return false
}

func ParseFrontmatter(content string) (*TaskFrontmatter, string, error) {
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

	var fm TaskFrontmatter
	if err := yaml.Unmarshal([]byte(yamlBlock), &fm); err != nil {
		return nil, "", err
	}

	// Lowercase tags for consistency
	for i, tag := range fm.Tags {
		fm.Tags[i] = strings.ToLower(tag)
	}

	return &fm, body, nil
}

func DumpFrontmatter(fm *TaskFrontmatter, body string) (string, error) {
	yamlBytes, err := yaml.Marshal(fm)
	if err != nil {
		return "", err
	}
	return "---\n" + string(yamlBytes) + "---\n" + body, nil
}

func SyncDBWithFiles(tasksDir string) (int, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	// Clear existing tables
	if _, err := tx.Exec("DELETE FROM tasks"); err != nil {
		return 0, err
	}
	if _, err := tx.Exec("DELETE FROM buckets"); err != nil {
		return 0, err
	}
	if _, err := tx.Exec("DELETE FROM projects"); err != nil {
		return 0, err
	}

	projects, err := LoadProjectsFile(tasksDir)
	if err != nil {
		return 0, err
	}

	count := 0
	ulidRegex := regexp.MustCompile("^[0-9A-HJKMNP-TV-Z]{26}$")

	for _, p := range projects {
		pID := p["id"].(string)
		pTitle := p["title"].(string)
		pCreated := p["created_at"].(string)
		var doneCleanPeriod sql.NullInt64
		if p["done_clean_period"] != nil {
			switch v := p["done_clean_period"].(type) {
			case float64:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int64:
				doneCleanPeriod = sql.NullInt64{Int64: v, Valid: true}
			case int:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			}
		}

		_, errProj := tx.Exec("INSERT INTO projects (id, title, created_at, done_clean_period) VALUES (?, ?, ?, ?)", pID, pTitle, pCreated, doneCleanPeriod)
		if errProj != nil {
			return 0, errProj
		}

		buckets, errBuck := LoadBucketsFile(tasksDir, pID)
		if errBuck != nil {
			return 0, errBuck
		}

		bucketNames := make(map[string]bool)
		maxBucketPosition := 0.0

		for _, b := range buckets {
			bName, _ := b["name"].(string)
			bTitle, _ := b["title"].(string)
			bSubtitle, _ := b["subtitle"].(string)
			
			var bPos float64
			if v, ok := b["position"].(float64); ok {
				bPos = v
			} else if v, ok := b["position"].(int64); ok {
				bPos = float64(v)
			} else if v, ok := b["position"].(int); ok {
				bPos = float64(v)
			}

			var bColor sql.NullString
			if val, ok := b["color"].(string); ok && val != "" {
				bColor = sql.NullString{String: val, Valid: true}
			}

			bLayout := "list"
			if val, ok := b["layout"].(string); ok {
				bLayout = val
			}

			var bMaxTasks sql.NullInt64
			if b["max_tasks"] != nil {
				switch v := b["max_tasks"].(type) {
				case float64:
					bMaxTasks = sql.NullInt64{Int64: int64(v), Valid: true}
				case int64:
					bMaxTasks = sql.NullInt64{Int64: v, Valid: true}
				case int:
					bMaxTasks = sql.NullInt64{Int64: int64(v), Valid: true}
				}
			}
			var bDefault bool
			if b["is_default"] != nil {
				if v, ok := b["is_default"].(bool); ok {
					bDefault = v
				}
			}

			_, errB := tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				pID, bName, bTitle, bSubtitle, bPos, bColor, bLayout, bMaxTasks, bDefault)
			if errB != nil {
				return 0, errB
			}
			bucketNames[bName] = true
			if bPos > maxBucketPosition {
				maxBucketPosition = bPos
			}
		}

		projectDir := filepath.Join(tasksDir, pID)
		bucketsModified := false

		files, errDir := os.ReadDir(projectDir)
		if errDir == nil {
			for _, f := range files {
				if f.IsDir() || !strings.HasSuffix(f.Name(), ".md") {
					continue
				}

				nameWithoutExt := f.Name()[:len(f.Name())-3]
				var taskID string

				if ulidRegex.MatchString(nameWithoutExt) {
					taskID = strings.ToUpper(nameWithoutExt)
				} else {
					parts := strings.SplitN(nameWithoutExt, "-", 2)
					if _, errVal := strconv.Atoi(parts[0]); errVal == nil {
						taskID = parts[0]
					} else {
						continue
					}
				}

				filePath := filepath.Join(projectDir, f.Name())
				data, errFile := os.ReadFile(filePath)
				if errFile != nil {
					log.Printf("Error reading file %s: %v", f.Name(), errFile)
					continue
				}

				fm, body, errFM := ParseFrontmatter(string(data))
				if errFM != nil {
					log.Printf("Error parsing frontmatter in %s: %v", f.Name(), errFM)
					continue
				}

				// Check done task cleaning
				if doneCleanPeriod.Valid && doneCleanPeriod.Int64 > 0 && fm.Bucket == "done" {
					checkDate := fm.UpdatedAt
					if checkDate == "" {
						checkDate = fm.CreatedAt
					}
					if checkDate != "" {
						if tParsed, errP := time.Parse(time.RFC3339, strings.Replace(checkDate, "Z", "+00:00", 1)); errP == nil {
							ageDays := int64(time.Since(tParsed).Hours() / 24)
							if ageDays >= doneCleanPeriod.Int64 {
								_ = os.Remove(filePath)
								log.Printf("Pruned done task file %s in project '%s' (age: %d days)", f.Name(), pID, ageDays)
								continue
							}
						}
					}
				}

				// Auto-create bucket
				if !bucketNames[fm.Bucket] {
					newTitle := strings.Title(strings.ReplaceAll(fm.Bucket, "-", " "))
					newPos := maxBucketPosition + 1000.0
					_, errB := tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
						pID, fm.Bucket, newTitle, "", newPos, nil, "list", nil, false)
					if errB != nil {
						return 0, errB
					}
					buckets = append(buckets, map[string]interface{}{
						"name":       fm.Bucket,
						"title":      newTitle,
						"subtitle":   "",
						"position":   newPos,
						"color":      nil,
						"layout":     "list",
						"max_tasks":  nil,
						"is_default": false,
					})
					bucketNames[fm.Bucket] = true
					maxBucketPosition = newPos
					bucketsModified = true
				}

				idVal := fm.ID
				if idVal == "" {
					idVal = taskID
				}

				tagsJSON, _ := json.Marshal(fm.Tags)
				var fmDueDate, fmPriority, fmColor sql.NullString
				if fm.DueDate != nil {
					fmDueDate = sql.NullString{String: *fm.DueDate, Valid: true}
				}
				if fm.Priority != nil {
					fmPriority = sql.NullString{String: *fm.Priority, Valid: true}
				}
				if fm.Color != nil {
					fmColor = sql.NullString{String: *fm.Color, Valid: true}
				}

				_, errT := tx.Exec("INSERT INTO tasks (id, project_id, title, bucket, position, tags, filename, body, due_date, priority, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					idVal, pID, fm.Title, fm.Bucket, fm.Position, string(tagsJSON), f.Name(), body, fmDueDate, fmPriority, fmColor, fm.CreatedAt, fm.UpdatedAt)
				if errT != nil {
					log.Printf("Error inserting task %s: %v", idVal, errT)
					continue
				}
				count++
			}
		}

		if bucketsModified {
			_ = WriteBucketsFile(tasksDir, pID, buckets)
		}
	}

	if errCommit := tx.Commit(); errCommit != nil {
		return 0, errCommit
	}

	return count, nil
}
