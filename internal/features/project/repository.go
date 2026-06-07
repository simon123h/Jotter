package project

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DBRepository defines the database operations for projects
type DBRepository interface {
	GetAll(ctx context.Context) ([]Response, error)
	Create(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error
	Update(ctx context.Context, id string, title string, doneCleanPeriod *int, gitRemote *string) error
	Delete(ctx context.Context, id string) error
}

// FileRepository defines the disk operations for projects
type FileRepository interface {
	LoadProjects(tasksDir string) ([]map[string]interface{}, error)
	WriteProjects(tasksDir string, projects []map[string]interface{}) error
	DeleteProjectDir(tasksDir string, projectID string) error
}

type sqlRepository struct {
	db *sql.DB
}

// NewSQLRepository creates a new DB repository instance
func NewSQLRepository(db *sql.DB) DBRepository {
	return &sqlRepository{db: db}
}

func (r *sqlRepository) GetAll(ctx context.Context) ([]Response, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, title, created_at, done_clean_period, git_remote FROM projects ORDER BY created_at ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Response
	for rows.Next() {
		var p Response
		var cleanPeriod sql.NullInt64
		var remote sql.NullString
		if err := rows.Scan(&p.ID, &p.Title, &p.CreatedAt, &cleanPeriod, &remote); err != nil {
			return nil, err
		}
		if cleanPeriod.Valid {
			v := int(cleanPeriod.Int64)
			p.DoneCleanPeriod = &v
		}
		if remote.Valid {
			p.GitRemote = &remote.String
		}
		projects = append(projects, p)
	}

	if projects == nil {
		projects = []Response{}
	}
	return projects, nil
}

func (r *sqlRepository) Create(ctx context.Context, id string, title string, createdAt string, doneCleanPeriod *int, gitRemote *string, defaultBuckets []map[string]interface{}) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var sqlCleanPeriod sql.NullInt64
	if doneCleanPeriod != nil {
		sqlCleanPeriod = sql.NullInt64{Int64: int64(*doneCleanPeriod), Valid: true}
	}

	var sqlGitRemote sql.NullString
	if gitRemote != nil {
		sqlGitRemote = sql.NullString{String: *gitRemote, Valid: true}
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
		id, title, createdAt, sqlCleanPeriod, sqlGitRemote)
	if err != nil {
		return err
	}

	for _, b := range defaultBuckets {
		bName := b["name"].(string)
		bTitle := b["title"].(string)
		bPos := b["position"].(float64)
		bDefault := b["is_default"].(bool)

		_, err = tx.ExecContext(ctx, "INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			id, bName, bTitle, "", bPos, nil, "list", nil, bDefault)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *sqlRepository) Update(ctx context.Context, id string, title string, doneCleanPeriod *int, gitRemote *string) error {
	var sqlCleanPeriod sql.NullInt64
	if doneCleanPeriod != nil {
		sqlCleanPeriod = sql.NullInt64{Int64: int64(*doneCleanPeriod), Valid: true}
	}

	var sqlGitRemote sql.NullString
	if gitRemote != nil {
		sqlGitRemote = sql.NullString{String: *gitRemote, Valid: true}
	}

	_, err := r.db.ExecContext(ctx, "UPDATE projects SET title = ?, done_clean_period = ?, git_remote = ? WHERE id = ?",
		title, sqlCleanPeriod, sqlGitRemote, id)
	return err
}

func (r *sqlRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM projects WHERE id = ?", id)
	return err
}

type fileRepository struct{}

// NewFileRepository creates a new File repository instance
func NewFileRepository() FileRepository {
	return &fileRepository{}
}

func (r *fileRepository) LoadProjects(tasksDir string) ([]map[string]interface{}, error) {
	return LoadProjectsFile(tasksDir)
}

func (r *fileRepository) WriteProjects(tasksDir string, projects []map[string]interface{}) error {
	return WriteProjectsFile(tasksDir, projects)
}

func (r *fileRepository) DeleteProjectDir(tasksDir string, projectID string) error {
	return DeleteProjectDir(tasksDir, projectID)
}

// Low-level helper functions (Kept for backwards compatibility and internal repository usage)

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
