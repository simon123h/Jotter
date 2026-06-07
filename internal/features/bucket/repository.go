package bucket

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
)

// DBRepository defines SQL operations for Kanban columns
type DBRepository interface {
	ProjectExists(ctx context.Context, projectID string) (bool, error)
	BucketExists(ctx context.Context, projectID string, name string) (bool, error)
	GetNextPosition(ctx context.Context, projectID string) (float64, error)
	GetAll(ctx context.Context, projectID string) ([]Response, error)
	GetOne(ctx context.Context, projectID string, name string) (*Response, error)
	Create(ctx context.Context, projectID string, b Response) error
	Update(ctx context.Context, projectID string, name string, b Response) error
	HasTasks(ctx context.Context, projectID string, name string) (bool, int, error)
	Delete(ctx context.Context, projectID string, name string) error
}

// FileRepository defines local disk operations for Kanban columns
type FileRepository interface {
	LoadBuckets(tasksDir string, projectID string) ([]map[string]interface{}, error)
	WriteBuckets(tasksDir string, projectID string, buckets []map[string]interface{}) error
}

type sqlRepository struct {
	db *sql.DB
}

// NewSQLRepository creates a new DB repository instance
func NewSQLRepository(db *sql.DB) DBRepository {
	return &sqlRepository{db: db}
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

func (r *sqlRepository) BucketExists(ctx context.Context, projectID string, name string) (bool, error) {
	var dummy string
	err := r.db.QueryRowContext(ctx, "SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, name).Scan(&dummy)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *sqlRepository) GetNextPosition(ctx context.Context, projectID string) (float64, error) {
	var maxPos sql.NullFloat64
	err := r.db.QueryRowContext(ctx, "SELECT MAX(position) FROM buckets WHERE project_id = ?", projectID).Scan(&maxPos)
	if err != nil {
		return 1000.0, err
	}
	if maxPos.Valid {
		return maxPos.Float64 + 1000.0, nil
	}
	return 1000.0, nil
}

func (r *sqlRepository) GetAll(ctx context.Context, projectID string) ([]Response, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT name, title, subtitle, position, color, layout, max_tasks, is_default FROM buckets WHERE project_id = ? ORDER BY position ASC", projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []Response
	for rows.Next() {
		var b Response
		var color sql.NullString
		var maxTasks sql.NullInt64

		if err := rows.Scan(&b.Name, &b.Title, &b.Subtitle, &b.Position, &color, &b.Layout, &maxTasks, &b.IsDefault); err != nil {
			return nil, err
		}
		if color.Valid {
			b.Color = &color.String
		}
		if maxTasks.Valid {
			v := int(maxTasks.Int64)
			b.MaxTasks = &v
		}
		buckets = append(buckets, b)
	}

	if buckets == nil {
		buckets = []Response{}
	}
	return buckets, nil
}

func (r *sqlRepository) GetOne(ctx context.Context, projectID string, name string) (*Response, error) {
	var b Response
	var color sql.NullString
	var maxTasks sql.NullInt64

	err := r.db.QueryRowContext(ctx, "SELECT name, title, subtitle, position, color, layout, max_tasks, is_default FROM buckets WHERE project_id = ? AND name = ?", projectID, name).Scan(
		&b.Name, &b.Title, &b.Subtitle, &b.Position, &color, &b.Layout, &maxTasks, &b.IsDefault)

	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}

	if color.Valid {
		b.Color = &color.String
	}
	if maxTasks.Valid {
		v := int(maxTasks.Int64)
		b.MaxTasks = &v
	}
	return &b, nil
}

func (r *sqlRepository) Create(ctx context.Context, projectID string, b Response) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if b.IsDefault {
		_, err = tx.ExecContext(ctx, "UPDATE buckets SET is_default = 0 WHERE project_id = ?", projectID)
		if err != nil {
			return err
		}
	}

	var updateColor sql.NullString
	if b.Color != nil {
		updateColor = sql.NullString{String: *b.Color, Valid: true}
	}

	var updateMaxTasks sql.NullInt64
	if b.MaxTasks != nil {
		updateMaxTasks = sql.NullInt64{Int64: int64(*b.MaxTasks), Valid: true}
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		projectID, b.Name, b.Title, b.Subtitle, b.Position, updateColor, b.Layout, updateMaxTasks, b.IsDefault)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *sqlRepository) Update(ctx context.Context, projectID string, name string, b Response) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if b.IsDefault {
		_, err = tx.ExecContext(ctx, "UPDATE buckets SET is_default = 0 WHERE project_id = ?", projectID)
		if err != nil {
			return err
		}
	}

	var updateColor sql.NullString
	if b.Color != nil {
		updateColor = sql.NullString{String: *b.Color, Valid: true}
	}

	var updateMaxTasks sql.NullInt64
	if b.MaxTasks != nil {
		updateMaxTasks = sql.NullInt64{Int64: int64(*b.MaxTasks), Valid: true}
	}

	_, err = tx.ExecContext(ctx, "UPDATE buckets SET title = ?, subtitle = ?, position = ?, color = ?, layout = ?, max_tasks = ?, is_default = ? WHERE project_id = ? AND name = ?",
		b.Title, b.Subtitle, b.Position, updateColor, b.Layout, updateMaxTasks, b.IsDefault, projectID, name)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *sqlRepository) HasTasks(ctx context.Context, projectID string, name string) (bool, int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND bucket = ?", projectID, name).Scan(&count)
	if err != nil {
		return false, 0, err
	}
	return count > 0, count, nil
}

func (r *sqlRepository) Delete(ctx context.Context, projectID string, name string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM buckets WHERE project_id = ? AND name = ?", projectID, name)
	return err
}

type fileRepository struct{}

// NewFileRepository creates a new File repository instance
func NewFileRepository() FileRepository {
	return &fileRepository{}
}

func (r *fileRepository) LoadBuckets(tasksDir string, projectID string) ([]map[string]interface{}, error) {
	return LoadBucketsFile(tasksDir, projectID)
}

func (r *fileRepository) WriteBuckets(tasksDir string, projectID string, buckets []map[string]interface{}) error {
	return WriteBucketsFile(tasksDir, projectID, buckets)
}

// Low-level helper functions and package values (Kept for backwards compatibility and internal repository usage)

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
