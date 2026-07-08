package task

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// DBRepository defines the database operations for tasks
type DBRepository interface {
	GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error)
	ProjectExists(ctx context.Context, projectID string) (bool, error)
	GetMaxTaskPosition(ctx context.Context, projectID string, bucket string) (float64, error)
	Create(ctx context.Context, task Response, filename string) error
	Update(ctx context.Context, oldProjectID string, task Response, filename string) error
	Delete(ctx context.Context, projectID string, taskID string) error
	UpdateAttachments(ctx context.Context, projectID string, taskID string, attachments []string) error
}

// FileRepository defines the disk operations for tasks
type FileRepository interface {
	GetTaskFilePath(tasksDir string, taskID string) (filePath string, filename string, projectID string, err error)
	ReadTaskFile(tasksDir string, taskID string) (*Response, error)
	WriteTaskFile(tasksDir string, taskID string, taskData map[string]interface{}) (string, error)
	DeleteTaskFile(tasksDir string, taskID string) bool
	SaveAttachment(tasksDir string, projectID string, taskID string, filename string, file io.Reader) error
	DeleteAttachment(tasksDir string, projectID string, taskID string, filename string) error
	GetAttachmentPath(tasksDir string, projectID string, taskID string, filename string) string
}

type sqlRepository struct {
	db *sql.DB
}

// NewSQLRepository creates a new DB repository instance
func NewSQLRepository(db *sql.DB) DBRepository {
	return &sqlRepository{db: db}
}

func (r *sqlRepository) GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error) {
	query := "SELECT id, project_id, title, bucket, position, tags, attachments, body, due_date, planned_date, priority, color, postponed_until, created_at, updated_at FROM tasks WHERE 1=1"
	var args []interface{}

	if filter.ProjectID != "" {
		query += " AND project_id = ?"
		args = append(args, filter.ProjectID)
	}

	if filter.Bucket != "" {
		if filter.Bucket == "postponed" {
			query += " AND postponed_until IS NOT NULL AND postponed_until > ?"
			args = append(args, time.Now().Format("2006-01-02"))
		} else {
			query += " AND bucket = ? AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?)"
			args = append(args, filter.Bucket, time.Now().Format("2006-01-02"))
		}
	} else {
		// If bucket is not specified, check if we should exclude active postponed tasks
		excludePostponed := false
		if filter.ExcludeBucket == "postponed" {
			excludePostponed = true
		}
		for _, b := range filter.ExcludeBuckets {
			if strings.TrimSpace(b) == "postponed" {
				excludePostponed = true
			}
		}
		if excludePostponed {
			query += " AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?)"
			args = append(args, time.Now().Format("2006-01-02"))
		}
	}

	if filter.ExcludeBucket != "" && filter.ExcludeBucket != "postponed" {
		query += " AND bucket != ?"
		args = append(args, filter.ExcludeBucket)
	}

	if len(filter.ExcludeBuckets) > 0 {
		var placeholders []string
		for _, b := range filter.ExcludeBuckets {
			b = strings.TrimSpace(b)
			if b != "" && b != "postponed" {
				placeholders = append(placeholders, "?")
				args = append(args, b)
			}
		}
		if len(placeholders) > 0 {
			query += fmt.Sprintf(" AND bucket NOT IN (%s)", strings.Join(placeholders, ","))
		}
	}

	if len(filter.Priorities) > 0 {
		var activePriorities []string
		var includeNone bool
		for _, p := range filter.Priorities {
			p = strings.TrimSpace(p)
			if p == "none" || p == "" {
				includeNone = true
			} else {
				activePriorities = append(activePriorities, p)
			}
		}

		if len(activePriorities) > 0 || includeNone {
			query += " AND ("
			var subConditions []string
			if includeNone {
				subConditions = append(subConditions, "(priority IS NULL OR priority = '')")
			}
			if len(activePriorities) > 0 {
				var placeholders []string
				for _, p := range activePriorities {
					placeholders = append(placeholders, "?")
					args = append(args, p)
				}
				subConditions = append(subConditions, fmt.Sprintf("priority IN (%s)", strings.Join(placeholders, ",")))
			}
			query += strings.Join(subConditions, " OR ")
			query += ")"
		}
	}

	if filter.ProjectID != "" {
		query += " ORDER BY position ASC"
	} else {
		query += " ORDER BY created_at DESC"
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var taskList []Response
	for rows.Next() {
		var t Response
		var tagsJSON, attachmentsJSON string
		var dueDate, plannedDate, priority, color, postponedUntil sql.NullString

		err := rows.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Bucket, &t.Position, &tagsJSON, &attachmentsJSON, &t.Body, &dueDate, &plannedDate, &priority, &color, &postponedUntil, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}

		_ = json.Unmarshal([]byte(tagsJSON), &t.Tags)
		_ = json.Unmarshal([]byte(attachmentsJSON), &t.Attachments)
		if dueDate.Valid {
			t.DueDate = &dueDate.String
		}
		if plannedDate.Valid {
			t.PlannedDate = &plannedDate.String
		}
		if priority.Valid {
			t.Priority = &priority.String
		}
		if color.Valid {
			t.Color = &color.String
		}
		if postponedUntil.Valid {
			t.PostponedUntil = &postponedUntil.String
		}

		taskList = append(taskList, t)
	}

	if taskList == nil {
		taskList = []Response{}
	}

	return taskList, nil
}

func (r *sqlRepository) ProjectExists(ctx context.Context, projectID string) (bool, error) {
	var dummy string
	err := r.db.QueryRowContext(ctx, "SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *sqlRepository) GetMaxTaskPosition(ctx context.Context, projectID string, bucket string) (float64, error) {
	var maxPos sql.NullFloat64
	err := r.db.QueryRowContext(ctx, "SELECT MAX(position) FROM tasks WHERE project_id = ? AND bucket = ?", projectID, bucket).Scan(&maxPos)
	if err != nil {
		return 0, err
	}
	if maxPos.Valid {
		return maxPos.Float64, nil
	}
	return 0, nil
}

func (r *sqlRepository) Create(ctx context.Context, task Response, filename string) error {
	tagsJSON, _ := json.Marshal(task.Tags)
	attachmentsJSON, _ := json.Marshal(task.Attachments)
	var dbDueDate, dbPlannedDate, dbPriority, dbColor, dbPostponedUntil sql.NullString
	if task.DueDate != nil {
		dbDueDate = sql.NullString{String: *task.DueDate, Valid: true}
	}
	if task.PlannedDate != nil {
		dbPlannedDate = sql.NullString{String: *task.PlannedDate, Valid: true}
	}
	if task.Priority != nil {
		dbPriority = sql.NullString{String: *task.Priority, Valid: true}
	}
	if task.Color != nil {
		dbColor = sql.NullString{String: *task.Color, Valid: true}
	}
	if task.PostponedUntil != nil {
		dbPostponedUntil = sql.NullString{String: *task.PostponedUntil, Valid: true}
	}

	_, err := r.db.ExecContext(ctx, "INSERT INTO tasks (id, project_id, title, bucket, position, tags, attachments, filename, body, due_date, planned_date, priority, color, postponed_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		task.ID, task.ProjectID, task.Title, task.Bucket, task.Position, string(tagsJSON), string(attachmentsJSON), filename, task.Body, dbDueDate, dbPlannedDate, dbPriority, dbColor, dbPostponedUntil, task.CreatedAt, task.UpdatedAt)
	return err
}

func (r *sqlRepository) Update(ctx context.Context, oldProjectID string, task Response, filename string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 1. If project ID changed, check if target project exists
	if task.ProjectID != oldProjectID {
		var pDummy string
		errP := tx.QueryRowContext(ctx, "SELECT id FROM projects WHERE id = ?", task.ProjectID).Scan(&pDummy)
		if errP == sql.ErrNoRows {
			return fmt.Errorf("target project '%s' not found", task.ProjectID)
		} else if errP != nil {
			return errP
		}
	}

	// 2. Check if bucket exists in target project
	var bDummy string
	errB := tx.QueryRowContext(ctx, "SELECT name FROM buckets WHERE project_id = ? AND name = ?", task.ProjectID, task.Bucket).Scan(&bDummy)
	if errB == sql.ErrNoRows {
		var maxPos sql.NullFloat64
		_ = tx.QueryRowContext(ctx, "SELECT MAX(position) FROM buckets WHERE project_id = ?", task.ProjectID).Scan(&maxPos)
		newPosition := 1000.0
		if maxPos.Valid {
			newPosition = maxPos.Float64 + 1000.0
		}

		title := task.Bucket
		if task.Bucket == "done" {
			title = "Done"
		} else if task.Bucket == "archive" {
			title = "Archive"
		} else if task.Bucket == "postponed" {
			title = "Postponed"
		}

		_, err = tx.ExecContext(ctx, "INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, '', ?, NULL, 'list', NULL, 0)",
			task.ProjectID, task.Bucket, title, newPosition)
		if err != nil {
			return err
		}
	} else if errB != nil {
		return errB
	}

	// 3. Update task
	tagsJSON, _ := json.Marshal(task.Tags)
	attachmentsJSON, _ := json.Marshal(task.Attachments)
	var dbDueDate, dbPlannedDate, dbPriority, dbColor, dbPostponedUntil sql.NullString
	if task.DueDate != nil {
		dbDueDate = sql.NullString{String: *task.DueDate, Valid: true}
	}
	if task.PlannedDate != nil {
		dbPlannedDate = sql.NullString{String: *task.PlannedDate, Valid: true}
	}
	if task.Priority != nil {
		dbPriority = sql.NullString{String: *task.Priority, Valid: true}
	}
	if task.Color != nil {
		dbColor = sql.NullString{String: *task.Color, Valid: true}
	}
	if task.PostponedUntil != nil {
		dbPostponedUntil = sql.NullString{String: *task.PostponedUntil, Valid: true}
	}

	_, err = tx.ExecContext(ctx, "UPDATE tasks SET project_id = ?, title = ?, bucket = ?, position = ?, tags = ?, attachments = ?, filename = ?, body = ?, due_date = ?, planned_date = ?, priority = ?, color = ?, postponed_until = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		task.ProjectID, task.Title, task.Bucket, task.Position, string(tagsJSON), string(attachmentsJSON), filename, task.Body, dbDueDate, dbPlannedDate, dbPriority, dbColor, dbPostponedUntil, task.UpdatedAt, task.ID, oldProjectID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *sqlRepository) Delete(ctx context.Context, projectID string, taskID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM tasks WHERE id = ? AND project_id = ?", taskID, projectID)
	return err
}

func (r *sqlRepository) UpdateAttachments(ctx context.Context, projectID string, taskID string, attachments []string) error {
	attJSON, err := json.Marshal(attachments)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, "UPDATE tasks SET attachments = ? WHERE id = ? AND project_id = ?", string(attJSON), taskID, projectID)
	return err
}

type fileRepository struct{}

// NewFileRepository creates a new File repository instance
func NewFileRepository() FileRepository {
	return &fileRepository{}
}

func (r *fileRepository) GetTaskFilePath(tasksDir string, taskID string) (filePath string, filename string, projectID string, err error) {
	return GetTaskFilePath(tasksDir, taskID)
}

func (r *fileRepository) ReadTaskFile(tasksDir string, taskID string) (*Response, error) {
	return ReadTaskFile(tasksDir, taskID)
}

func (r *fileRepository) WriteTaskFile(tasksDir string, taskID string, taskData map[string]interface{}) (string, error) {
	return WriteTaskFile(tasksDir, taskID, taskData)
}

func (r *fileRepository) DeleteTaskFile(tasksDir string, taskID string) bool {
	return DeleteTaskFile(tasksDir, taskID)
}

func (r *fileRepository) SaveAttachment(tasksDir string, projectID string, taskID string, filename string, file io.Reader) error {
	attachmentsDir := filepath.Join(tasksDir, projectID, taskID+".attachments")
	if err := os.MkdirAll(attachmentsDir, 0755); err != nil {
		return err
	}

	dstPath := filepath.Join(attachmentsDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	return err
}

func (r *fileRepository) DeleteAttachment(tasksDir string, projectID string, taskID string, filename string) error {
	filePath := filepath.Join(tasksDir, projectID, taskID+".attachments", filename)
	return os.Remove(filePath)
}

func (r *fileRepository) GetAttachmentPath(tasksDir string, projectID string, taskID string, filename string) string {
	return filepath.Join(tasksDir, projectID, taskID+".attachments", filename)
}

// Low-level helper functions (Kept for backwards compatibility and internal repository usage)

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
		ID:             taskID,
		ProjectID:      projectID,
		Title:          fm.Title,
		Bucket:         fm.Bucket,
		Position:       fm.Position,
		Tags:           fm.Tags,
		Attachments:    fm.Attachments,
		Body:           body,
		DueDate:        fm.DueDate,
		PlannedDate:    fm.PlannedDate,
		Priority:       fm.Priority,
		Color:          fm.Color,
		PostponedUntil: fm.PostponedUntil,
		CreatedAt:      fm.CreatedAt,
		UpdatedAt:      fm.UpdatedAt,
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

	var dueDate, plannedDate, priority, color, postponedUntil *string
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

	if val, okVal := taskData["postponed_until"].(*string); okVal {
		postponedUntil = val
	} else if val, okVal := taskData["postponed_until"].(string); okVal && val != "" {
		postponedUntil = &val
	}

	fm := Frontmatter{
		ID:             taskID,
		ProjectID:      projectID,
		Title:          taskData["title"].(string),
		Bucket:         taskData["bucket"].(string),
		Position:       taskData["position"].(float64),
		Tags:           tags,
		Attachments:    attachments,
		DueDate:        dueDate,
		PlannedDate:    plannedDate,
		Priority:       priority,
		Color:          color,
		PostponedUntil: postponedUntil,
		CreatedAt:      taskData["created_at"].(string),
		UpdatedAt:      taskData["updated_at"].(string),
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
