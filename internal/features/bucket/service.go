package bucket

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"jotter/backend/internal/features/common"
)

// Standard domain errors
var (
	ErrProjectNotFound = errors.New("project not found")
	ErrBucketNotFound  = errors.New("column not found")
	ErrDuplicateBucket = errors.New("column already exists")
	ErrBucketNotEmpty  = errors.New("column cannot be deleted because it contains tasks")
	ErrInvalidInput    = errors.New("invalid input")
)

// Service defines business operations for Kanban columns
type Service interface {
	GetBuckets(ctx context.Context, projectID string) ([]Response, error)
	CreateBucket(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error)
	UpdateBucket(ctx context.Context, tasksDir string, projectID string, name string, req Update) (*Response, error)
	DeleteBucket(ctx context.Context, tasksDir string, projectID string, name string) error
}

type bucketService struct {
	dbRepo   DBRepository
	fileRepo FileRepository
}

// NewService creates a new bucket service instance
func NewService(dbRepo DBRepository, fileRepo FileRepository) Service {
	return &bucketService{
		dbRepo:   dbRepo,
		fileRepo: fileRepo,
	}
}

func (s *bucketService) GetBuckets(ctx context.Context, projectID string) ([]Response, error) {
	// Verify project exists
	exists, err := s.dbRepo.ProjectExists(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify project: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: project '%s'", ErrProjectNotFound, projectID)
	}

	return s.dbRepo.GetAll(ctx, projectID)
}

func (s *bucketService) CreateBucket(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error) {
	// Verify project exists
	exists, err := s.dbRepo.ProjectExists(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify project: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: project '%s'", ErrProjectNotFound, projectID)
	}

	name := common.Slugify(req.Title)
	if name == "" {
		return nil, fmt.Errorf("%w: invalid title, could not generate a column name slug", ErrInvalidInput)
	}

	// Verify column doesn't exist
	duplicate, err := s.dbRepo.BucketExists(ctx, projectID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to verify column uniqueness: %w", err)
	}
	if duplicate {
		return nil, fmt.Errorf("%w: column '%s' already exists in project '%s'", ErrDuplicateBucket, name, projectID)
	}

	// Compute position
	nextPos, err := s.dbRepo.GetNextPosition(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to compute column position: %w", err)
	}

	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	}

	var subtitle string
	if req.Subtitle != nil {
		subtitle = *req.Subtitle
	}

	layout := "list"
	if req.Layout != nil {
		layout = *req.Layout
	}

	newBucket := Response{
		Name:      name,
		Title:     req.Title,
		Subtitle:  subtitle,
		Position:  nextPos,
		Color:     req.Color,
		Layout:    layout,
		MaxTasks:  req.MaxTasks,
		IsDefault: isDefault,
	}

	// Save to DB (encapsulated transaction)
	if err := s.dbRepo.Create(ctx, projectID, newBucket); err != nil {
		return nil, fmt.Errorf("failed to save column to database: %w", err)
	}

	// Sync database columns to disk buckets.json
	if err := s.syncBuckets(ctx, tasksDir, projectID); err != nil {
		// Rollback DB insertion
		_ = s.dbRepo.Delete(ctx, projectID, name)
		return nil, fmt.Errorf("failed to sync columns file to disk: %w", err)
	}

	return &newBucket, nil
}

func (s *bucketService) UpdateBucket(ctx context.Context, tasksDir string, projectID string, name string, req Update) (*Response, error) {
	// Verify project exists
	exists, err := s.dbRepo.ProjectExists(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify project: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: project '%s'", ErrProjectNotFound, projectID)
	}

	// Fetch current state
	b, err := s.dbRepo.GetOne(ctx, projectID, name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("%w: column '%s' in project '%s'", ErrBucketNotFound, name, projectID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to fetch column: %w", err)
	}

	// Capture previous state for rollback if file-write fails
	previousState := *b

	// Apply delta updates
	if req.Title != nil {
		b.Title = *req.Title
	}
	if req.Subtitle != nil {
		b.Subtitle = *req.Subtitle
	}
	if req.Position != nil {
		b.Position = *req.Position
	}
	if req.Color != nil {
		b.Color = req.Color
	}
	if req.Layout != nil {
		b.Layout = *req.Layout
	}
	if req.MaxTasks != nil {
		b.MaxTasks = req.MaxTasks
	}
	if req.IsDefault != nil {
		b.IsDefault = *req.IsDefault
	}

	// Update DB (encapsulated transaction)
	if err := s.dbRepo.Update(ctx, projectID, name, *b); err != nil {
		return nil, fmt.Errorf("failed to update column in database: %w", err)
	}

	// Sync database state to disk
	if err := s.syncBuckets(ctx, tasksDir, projectID); err != nil {
		// Rollback DB update to previous state
		_ = s.dbRepo.Update(ctx, projectID, name, previousState)
		return nil, fmt.Errorf("failed to sync columns file to disk: %w", err)
	}

	return b, nil
}

func (s *bucketService) DeleteBucket(ctx context.Context, tasksDir string, projectID string, name string) error {
	// Verify project exists
	exists, err := s.dbRepo.ProjectExists(ctx, projectID)
	if err != nil {
		return fmt.Errorf("failed to verify project: %w", err)
	}
	if !exists {
		return fmt.Errorf("%w: project '%s'", ErrProjectNotFound, projectID)
	}

	// Fetch bucket to verify existence & capture for potential rollback
	b, err := s.dbRepo.GetOne(ctx, projectID, name)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("%w: column '%s' in project '%s'", ErrBucketNotFound, name, projectID)
	} else if err != nil {
		return fmt.Errorf("failed to fetch column: %w", err)
	}

	// Check if the column has any tasks
	hasTasks, count, err := s.dbRepo.HasTasks(ctx, projectID, name)
	if err != nil {
		return fmt.Errorf("failed to check column tasks: %w", err)
	}
	if hasTasks {
		return fmt.Errorf("%w: column '%s' has %d tasks", ErrBucketNotEmpty, name, count)
	}

	// Delete from DB
	if err := s.dbRepo.Delete(ctx, projectID, name); err != nil {
		return fmt.Errorf("failed to delete column from database: %w", err)
	}

	// Sync updated DB state to disk
	if err := s.syncBuckets(ctx, tasksDir, projectID); err != nil {
		// Rollback DB deletion
		_ = s.dbRepo.Create(ctx, projectID, *b)
		return fmt.Errorf("failed to sync columns file to disk: %w", err)
	}

	return nil
}

// Private helper to query SQL DB state and write down a fresh copy to buckets.json file
func (s *bucketService) syncBuckets(ctx context.Context, tasksDir string, projectID string) error {
	buckets, err := s.dbRepo.GetAll(ctx, projectID)
	if err != nil {
		return err
	}

	var jsonBuckets []map[string]interface{}
	for _, b := range buckets {
		bMap := map[string]interface{}{
			"name":       b.Name,
			"title":      b.Title,
			"subtitle":   b.Subtitle,
			"position":   b.Position,
			"layout":     b.Layout,
			"is_default": b.IsDefault,
		}
		if b.Color != nil {
			bMap["color"] = *b.Color
		} else {
			bMap["color"] = nil
		}
		if b.MaxTasks != nil {
			bMap["max_tasks"] = *b.MaxTasks
		} else {
			bMap["max_tasks"] = nil
		}

		jsonBuckets = append(jsonBuckets, bMap)
	}

	return s.fileRepo.WriteBuckets(tasksDir, projectID, jsonBuckets)
}
