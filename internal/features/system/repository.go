package system

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/settings"
)

// ProjectSyncInfo holds basic details needed during git sync
type ProjectSyncInfo struct {
	ID        string
	RemoteURL string
}

// BucketSyncInfo represents DB columns configuration to insert during sync
type BucketSyncInfo struct {
	ProjectID string
	Name      string
	Title     string
	Subtitle  string
	Position  float64
	Layout    string
	IsDefault bool
	Color     *string
	MaxTasks  *int
}

// TaskSyncInfo represents SQLite task attributes to rebuild
type TaskSyncInfo struct {
	ID          string
	ProjectID   string
	Title       string
	Bucket      string
	Position    float64
	Tags        []string
	Attachments []string
	Filename    string
	Body        string
	DueDate     *string
	PlannedDate *string
	Priority    *string
	Color       *string
	CreatedAt   string
	UpdatedAt   string
}

// DBRepository defines the database operations for system sync
type DBRepository interface {
	GetProjects(ctx context.Context) ([]ProjectSyncInfo, error)
	RebuildIndex(ctx context.Context, projects []map[string]interface{}, buckets []BucketSyncInfo, tasks []TaskSyncInfo) (int, error)
}

// FileRepository defines the filesystem operations for system sync
type FileRepository interface {
	LoadProjectsFile(tasksDir string) ([]map[string]interface{}, error)
	ReadDir(path string) ([]os.DirEntry, error)
	ReadFile(path string) ([]byte, error)
	RemoveFile(path string) error
	RemoveDirAll(path string) error
	WriteFile(path string, data []byte) error
	GitSync(path string, remoteURL string) error
}

type sqlRepository struct {
	db *sql.DB
}

// NewSQLRepository creates a new DB repository instance for system sync
func NewSQLRepository(db *sql.DB) DBRepository {
	return &sqlRepository{db: db}
}

func (r *sqlRepository) GetProjects(ctx context.Context) ([]ProjectSyncInfo, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, git_remote FROM projects")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []ProjectSyncInfo
	for rows.Next() {
		var id string
		var remote sql.NullString
		if err := rows.Scan(&id, &remote); err != nil {
			continue
		}

		remoteURL := ""
		if remote.Valid {
			remoteURL = remote.String
		}

		projects = append(projects, ProjectSyncInfo{
			ID:        id,
			RemoteURL: remoteURL,
		})
	}
	return projects, nil
}

func (r *sqlRepository) RebuildIndex(ctx context.Context, projects []map[string]interface{}, buckets []BucketSyncInfo, tasks []TaskSyncInfo) (int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	_, _ = tx.ExecContext(ctx, "DELETE FROM tasks")
	_, _ = tx.ExecContext(ctx, "DELETE FROM buckets")
	_, _ = tx.ExecContext(ctx, "DELETE FROM projects")

	for _, p := range projects {
		pID := p["id"].(string)
		title := p["title"].(string)
		created := p["created_at"].(string)

		var doneCleanPeriod sql.NullInt64
		if p["done_clean_period"] != nil {
			switch v := p["done_clean_period"].(type) {
			case float64:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int64:
				doneCleanPeriod = sql.NullInt64{Int64: v, Valid: true}
			}
		}

		var gitRemote sql.NullString
		if p["git_remote"] != nil {
			if r, ok := p["git_remote"].(string); ok {
				gitRemote = sql.NullString{String: r, Valid: true}
			}
		}

		_, err = tx.ExecContext(ctx, "INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
			pID, title, created, doneCleanPeriod, gitRemote)
		if err != nil {
			return 0, err
		}
	}

	for _, b := range buckets {
		var bColor sql.NullString
		if b.Color != nil {
			bColor = sql.NullString{String: *b.Color, Valid: true}
		}

		var bMaxTasks sql.NullInt64
		if b.MaxTasks != nil {
			bMaxTasks = sql.NullInt64{Int64: int64(*b.MaxTasks), Valid: true}
		}

		_, err = tx.ExecContext(ctx, "INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			b.ProjectID, b.Name, b.Title, b.Subtitle, b.Position, bColor, b.Layout, bMaxTasks, b.IsDefault)
		if err != nil {
			return 0, err
		}
	}

	count := 0
	for _, t := range tasks {
		tagsJSON, _ := json.Marshal(t.Tags)
		attachmentsJSON, _ := json.Marshal(t.Attachments)
		var fmDueDate, fmPlannedDate, fmPriority, fmColor sql.NullString
		if t.DueDate != nil {
			fmDueDate = sql.NullString{String: *t.DueDate, Valid: true}
		}
		if t.PlannedDate != nil {
			fmPlannedDate = sql.NullString{String: *t.PlannedDate, Valid: true}
		}
		if t.Priority != nil {
			fmPriority = sql.NullString{String: *t.Priority, Valid: true}
		}
		if t.Color != nil {
			fmColor = sql.NullString{String: *t.Color, Valid: true}
		}

		_, errT := tx.ExecContext(ctx, "INSERT INTO tasks (id, project_id, title, bucket, position, tags, attachments, filename, body, due_date, planned_date, priority, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			t.ID, t.ProjectID, t.Title, t.Bucket, t.Position, string(tagsJSON), string(attachmentsJSON), t.Filename, t.Body, fmDueDate, fmPlannedDate, fmPriority, fmColor, t.CreatedAt, t.UpdatedAt)
		if errT != nil {
			continue
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}

type fileRepository struct{}

// NewFileRepository creates a new File repository instance for system sync
func NewFileRepository() FileRepository {
	return &fileRepository{}
}

func (r *fileRepository) LoadProjectsFile(tasksDir string) ([]map[string]interface{}, error) {
	return project.LoadProjectsFile(tasksDir)
}

func (r *fileRepository) ReadDir(path string) ([]os.DirEntry, error) {
	return os.ReadDir(path)
}

func (r *fileRepository) ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func (r *fileRepository) RemoveFile(path string) error {
	return os.Remove(path)
}

func (r *fileRepository) RemoveDirAll(path string) error {
	return os.RemoveAll(path)
}

func (r *fileRepository) WriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}

func (r *fileRepository) GitSync(path string, remoteURL string) error {
	return common.GitSync(path, remoteURL)
}

// SyncDBWithFiles maintains 100% backwards compatibility with other system callers (bootstrap, integration tests)
func SyncDBWithFiles(tasksDir string) (int, error) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	settingsRepo := settings.NewFileRepository()
	svc := NewService(dbRepo, fileRepo, settingsRepo)
	return svc.SyncDBOnly(context.Background(), tasksDir)
}
