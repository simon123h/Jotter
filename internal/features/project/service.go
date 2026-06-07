package project

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"jotter/backend/internal/features/common"
)

// Standard domain errors
var (
	ErrProjectNotFound = errors.New("project not found")
	ErrDuplicateProject = errors.New("project already exists")
	ErrLastProject      = errors.New("cannot delete the last remaining project")
	ErrInvalidInput     = errors.New("invalid input")
)

// Service coordinates domain business logic for projects
type Service interface {
	GetProjects(ctx context.Context) ([]Response, error)
	CreateProject(ctx context.Context, tasksDir string, req Create, defaultBuckets []map[string]interface{}, syncBucketsFunc func(string, string) error) (*Response, error)
	UpdateProject(ctx context.Context, tasksDir string, projectID string, raw map[string]interface{}, req Update) (*Response, error)
	DeleteProject(ctx context.Context, tasksDir string, projectID string) error
}

type projectService struct {
	dbRepo   DBRepository
	fileRepo FileRepository
}

// NewService creates a new project service instance
func NewService(dbRepo DBRepository, fileRepo FileRepository) Service {
	return &projectService{
		dbRepo:   dbRepo,
		fileRepo: fileRepo,
	}
}

func (s *projectService) GetProjects(ctx context.Context) ([]Response, error) {
	return s.dbRepo.GetAll(ctx)
}

func (s *projectService) CreateProject(ctx context.Context, tasksDir string, req Create, defaultBuckets []map[string]interface{}, syncBucketsFunc func(string, string) error) (*Response, error) {
	projectID := common.Slugify(req.Title)
	if projectID == "" {
		return nil, fmt.Errorf("%w: invalid title, could not generate a project ID slug", ErrInvalidInput)
	}

	projects, err := s.fileRepo.LoadProjects(tasksDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load projects: %w", err)
	}

	for _, p := range projects {
		if p["id"] == projectID {
			return nil, fmt.Errorf("%w: project with ID '%s' already exists", ErrDuplicateProject, projectID)
		}
	}

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

	var gitRemoteVal interface{}
	if req.GitRemote != nil {
		gitRemoteVal = *req.GitRemote
	} else {
		gitRemoteVal = nil
	}

	newProject := map[string]interface{}{
		"id":                projectID,
		"title":             req.Title,
		"created_at":        nowStr,
		"done_clean_period": req.DoneCleanPeriod,
		"git_remote":        gitRemoteVal,
	}

	// Update Disk File
	projects = append(projects, newProject)
	if err := s.fileRepo.WriteProjects(tasksDir, projects); err != nil {
		return nil, fmt.Errorf("failed to write projects registry to disk: %w", err)
	}

	// Update SQLite database (including default buckets within internal database transaction)
	if err := s.dbRepo.Create(ctx, projectID, req.Title, nowStr, req.DoneCleanPeriod, req.GitRemote, defaultBuckets); err != nil {
		// Rollback file addition (by reloading, filtering, and writing back) to ensure transactional parity
		if rolledBackProjects, errReload := s.fileRepo.LoadProjects(tasksDir); errReload == nil {
			var filtered []map[string]interface{}
			for _, p := range rolledBackProjects {
				if p["id"] != projectID {
					filtered = append(filtered, p)
				}
			}
			_ = s.fileRepo.WriteProjects(tasksDir, filtered)
		}
		return nil, fmt.Errorf("failed to sync database: %w", err)
	}

	// Perform buckets file sync on disk
	if syncBucketsFunc != nil {
		_ = syncBucketsFunc(tasksDir, projectID)
	}

	return &Response{
		ID:              projectID,
		Title:           req.Title,
		CreatedAt:       nowStr,
		DoneCleanPeriod: req.DoneCleanPeriod,
		GitRemote:       req.GitRemote,
	}, nil
}

func (s *projectService) UpdateProject(ctx context.Context, tasksDir string, projectID string, raw map[string]interface{}, req Update) (*Response, error) {
	projects, err := s.fileRepo.LoadProjects(tasksDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load projects: %w", err)
	}

	var projectFound map[string]interface{}
	for _, p := range projects {
		if p["id"] == projectID {
			projectFound = p
			break
		}
	}

	if projectFound == nil {
		return nil, fmt.Errorf("%w: project with ID '%s'", ErrProjectNotFound, projectID)
	}

	// Apply delta updates from raw JSON representation
	if _, ok := raw["title"]; ok && req.Title != nil {
		projectFound["title"] = *req.Title
	}
	if _, ok := raw["done_clean_period"]; ok {
		projectFound["done_clean_period"] = req.DoneCleanPeriod
	}
	if _, ok := raw["git_remote"]; ok {
		if req.GitRemote != nil {
			projectFound["git_remote"] = *req.GitRemote
		} else {
			projectFound["git_remote"] = nil
		}
	}

	// Save to projects registry
	if err := s.fileRepo.WriteProjects(tasksDir, projects); err != nil {
		return nil, fmt.Errorf("failed to write projects registry to disk: %w", err)
	}

	// Resolve database field types from interface maps safely
	var doneCleanPeriod *int
	if projectFound["done_clean_period"] != nil {
		switch v := projectFound["done_clean_period"].(type) {
		case float64:
			val := int(v)
			doneCleanPeriod = &val
		case int:
			val := v
			doneCleanPeriod = &val
		case int64:
			val := int(v)
			doneCleanPeriod = &val
		}
	}

	var gitRemote *string
	if projectFound["git_remote"] != nil {
		if r, ok := projectFound["git_remote"].(string); ok {
			gitRemote = &r
		}
	}

	title, _ := projectFound["title"].(string)

	// Save to DB
	if err := s.dbRepo.Update(ctx, projectID, title, doneCleanPeriod, gitRemote); err != nil {
		return nil, fmt.Errorf("failed to update project in database: %w", err)
	}

	created, _ := projectFound["created_at"].(string)

	return &Response{
		ID:              projectID,
		Title:           title,
		CreatedAt:       created,
		DoneCleanPeriod: doneCleanPeriod,
		GitRemote:       gitRemote,
	}, nil
}

func (s *projectService) DeleteProject(ctx context.Context, tasksDir string, projectID string) error {
	projects, err := s.fileRepo.LoadProjects(tasksDir)
	if err != nil {
		return fmt.Errorf("failed to load projects: %w", err)
	}

	if len(projects) <= 1 {
		return ErrLastProject
	}

	var filtered []map[string]interface{}
	found := false
	for _, p := range projects {
		if p["id"] == projectID {
			found = true
		} else {
			filtered = append(filtered, p)
		}
	}

	if !found {
		return fmt.Errorf("%w: project with ID '%s'", ErrProjectNotFound, projectID)
	}

	// Update Disk File
	if err := s.fileRepo.WriteProjects(tasksDir, filtered); err != nil {
		return fmt.Errorf("failed to update projects registry: %w", err)
	}

	// Delete local task files
	if err := s.fileRepo.DeleteProjectDir(tasksDir, projectID); err != nil {
		return fmt.Errorf("failed to delete project files: %w", err)
	}

	// Cascade delete from DB
	if err := s.dbRepo.Delete(ctx, projectID); err != nil {
		return fmt.Errorf("failed to delete project from database: %w", err)
	}

	return nil
}
