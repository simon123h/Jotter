package task

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"jotter/backend/internal/features/common"
)

// Standard domain errors
var (
	ErrTaskNotFound    = errors.New("task not found")
	ErrProjectNotFound = errors.New("project not found")
	ErrInvalidInput    = errors.New("invalid input")
)

// TaskFilter encapsulates parameters for filtering task lists
type TaskFilter struct {
	ProjectID      string
	Bucket         string
	ExcludeBucket  string
	ExcludeBuckets []string
	Priorities     []string
}

// Service coordinates domain business logic for tasks
type Service interface {
	GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error)
	GetTaskByID(ctx context.Context, tasksDir string, taskID string) (*Response, error)
	CreateTask(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error)
	UpdateTask(ctx context.Context, tasksDir string, projectID string, taskID string, raw map[string]interface{}, req Update, syncBucketsFunc func(string, string) error) (*Response, error)
	MoveTask(ctx context.Context, tasksDir string, projectID string, taskID string, req Move, syncBucketsFunc func(string, string) error) (*Response, error)
	DeleteTask(ctx context.Context, tasksDir string, projectID string, taskID string) error
	SaveAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string, file io.Reader) (*Response, error)
	DeleteAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (*Response, error)
	GetAttachmentPath(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (string, error)
}

type taskService struct {
	dbRepo   DBRepository
	fileRepo FileRepository
}

// NewService creates a new task service instance
func NewService(dbRepo DBRepository, fileRepo FileRepository) Service {
	return &taskService{
		dbRepo:   dbRepo,
		fileRepo: fileRepo,
	}
}

func (s *taskService) GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error) {
	if filter.ProjectID != "" {
		exists, err := s.dbRepo.ProjectExists(ctx, filter.ProjectID)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, fmt.Errorf("%w: project '%s'", ErrProjectNotFound, filter.ProjectID)
		}
	}
	return s.dbRepo.GetTasks(ctx, filter)
}

func (s *taskService) GetTaskByID(ctx context.Context, tasksDir string, taskID string) (*Response, error) {
	res, err := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrTaskNotFound, err.Error())
	}
	return res, nil
}

func (s *taskService) CreateTask(ctx context.Context, tasksDir string, projectID string, req Create) (*Response, error) {
	exists, err := s.dbRepo.ProjectExists(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("%w: project '%s'", ErrProjectNotFound, projectID)
	}

	newID := common.GenerateULID()
	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

	maxPos, err := s.dbRepo.GetMaxTaskPosition(ctx, projectID, req.Bucket)
	if err != nil {
		return nil, err
	}
	newPosition := 1000.0
	if maxPos > 0 {
		newPosition = maxPos + 1000.0
	}

	var tags []string
	for _, t := range req.Tags {
		tags = append(tags, strings.ToLower(t))
	}

	taskMap := map[string]interface{}{
		"id":           newID,
		"project_id":   projectID,
		"title":        req.Title,
		"bucket":       req.Bucket,
		"position":     newPosition,
		"tags":         tags,
		"attachments":  []string{},
		"body":         req.Body,
		"due_date":     req.DueDate,
		"planned_date": req.PlannedDate,
		"priority":     req.Priority,
		"color":        req.Color,
		"created_at":   nowStr,
		"updated_at":   nowStr,
	}

	// Write to Disk File
	filename, errWrite := s.fileRepo.WriteTaskFile(tasksDir, newID, taskMap)
	if errWrite != nil {
		return nil, fmt.Errorf("failed to write task file: %w", errWrite)
	}

	res := Response{
		ID:          newID,
		ProjectID:   projectID,
		Title:       req.Title,
		Bucket:      req.Bucket,
		Position:    newPosition,
		Tags:        tags,
		Attachments: []string{},
		Body:        req.Body,
		DueDate:     req.DueDate,
		PlannedDate: req.PlannedDate,
		Priority:    req.Priority,
		Color:       req.Color,
		CreatedAt:   nowStr,
		UpdatedAt:   nowStr,
	}

	// Save to DB
	if err := s.dbRepo.Create(ctx, res, filename); err != nil {
		// Rollback file on failure
		_ = s.fileRepo.DeleteTaskFile(tasksDir, newID)
		return nil, fmt.Errorf("failed to save task to database: %w", err)
	}

	return &res, nil
}

func (s *taskService) UpdateTask(ctx context.Context, tasksDir string, projectID string, taskID string, raw map[string]interface{}, req Update, syncBucketsFunc func(string, string) error) (*Response, error) {
	existing, errRead := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if errRead != nil || existing.ProjectID != projectID {
		return nil, fmt.Errorf("%w: task with ID %s not found in project '%s'", ErrTaskNotFound, taskID, projectID)
	}

	oldTaskMap := map[string]interface{}{
		"project_id":   existing.ProjectID,
		"title":        existing.Title,
		"bucket":       existing.Bucket,
		"position":     existing.Position,
		"tags":         existing.Tags,
		"attachments":  existing.Attachments,
		"body":         existing.Body,
		"due_date":     existing.DueDate,
		"planned_date": existing.PlannedDate,
		"priority":     existing.Priority,
		"color":        existing.Color,
		"created_at":   existing.CreatedAt,
		"updated_at":   existing.UpdatedAt,
	}

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

	updatedTitle := existing.Title
	if _, ok := raw["title"]; ok && req.Title != nil {
		updatedTitle = *req.Title
	}

	updatedBucket := existing.Bucket
	if _, ok := raw["bucket"]; ok && req.Bucket != nil {
		updatedBucket = *req.Bucket
	}

	updatedPosition := existing.Position
	if _, ok := raw["position"]; ok && req.Position != nil {
		updatedPosition = *req.Position
	}

	var updatedTags []string
	if _, ok := raw["tags"]; ok && req.Tags != nil {
		for _, tg := range *req.Tags {
			updatedTags = append(updatedTags, strings.ToLower(tg))
		}
	} else {
		updatedTags = existing.Tags
	}

	updatedBody := existing.Body
	if _, ok := raw["body"]; ok && req.Body != nil {
		updatedBody = *req.Body
	}

	updatedDueDate := existing.DueDate
	if _, ok := raw["due_date"]; ok {
		updatedDueDate = req.DueDate
	}

	updatedPlannedDate := existing.PlannedDate
	if _, ok := raw["planned_date"]; ok {
		updatedPlannedDate = req.PlannedDate
	}

	updatedPriority := existing.Priority
	if _, ok := raw["priority"]; ok {
		updatedPriority = req.Priority
	}

	updatedColor := existing.Color
	if _, ok := raw["color"]; ok {
		updatedColor = req.Color
	}

	updatedAttachments := existing.Attachments
	if _, ok := raw["attachments"]; ok && req.Attachments != nil {
		updatedAttachments = *req.Attachments
	}

	updatedProjectID := existing.ProjectID
	if _, ok := raw["project_id"]; ok && req.ProjectID != nil {
		updatedProjectID = *req.ProjectID
	}

	taskMap := map[string]interface{}{
		"project_id":   updatedProjectID,
		"title":        updatedTitle,
		"bucket":       updatedBucket,
		"position":     updatedPosition,
		"tags":         updatedTags,
		"attachments":  updatedAttachments,
		"body":         updatedBody,
		"due_date":     updatedDueDate,
		"planned_date": updatedPlannedDate,
		"priority":     updatedPriority,
		"color":        updatedColor,
		"created_at":   existing.CreatedAt,
		"updated_at":   nowStr,
	}

	// Write to Disk
	filename, errWrite := s.fileRepo.WriteTaskFile(tasksDir, taskID, taskMap)
	if errWrite != nil {
		return nil, fmt.Errorf("failed to write task file: %w", errWrite)
	}

	res := Response{
		ID:          taskID,
		ProjectID:   updatedProjectID,
		Title:       updatedTitle,
		Bucket:      updatedBucket,
		Position:    updatedPosition,
		Tags:        updatedTags,
		Attachments: updatedAttachments,
		Body:        updatedBody,
		DueDate:     updatedDueDate,
		PlannedDate: updatedPlannedDate,
		Priority:    updatedPriority,
		Color:       updatedColor,
		CreatedAt:   existing.CreatedAt,
		UpdatedAt:   nowStr,
	}

	// Update DB (handles transaction and automatic Done/Archive column creation)
	if err := s.dbRepo.Update(ctx, projectID, res, filename); err != nil {
		// Rollback file addition/modification on disk
		_, _ = s.fileRepo.WriteTaskFile(tasksDir, taskID, oldTaskMap)
		return nil, fmt.Errorf("failed to update database: %w", err)
	}

	// Trigger bucket syncing if columns changed
	if syncBucketsFunc != nil {
		if updatedProjectID != existing.ProjectID {
			_ = syncBucketsFunc(tasksDir, existing.ProjectID)
			_ = syncBucketsFunc(tasksDir, updatedProjectID)
		} else if updatedBucket != existing.Bucket {
			_ = syncBucketsFunc(tasksDir, projectID)
		}
	}

	return &res, nil
}

func (s *taskService) MoveTask(ctx context.Context, tasksDir string, projectID string, taskID string, req Move, syncBucketsFunc func(string, string) error) (*Response, error) {
	existing, errRead := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if errRead != nil || existing.ProjectID != projectID {
		return nil, fmt.Errorf("%w: task with ID %s not found in project '%s'", ErrTaskNotFound, taskID, projectID)
	}

	oldTaskMap := map[string]interface{}{
		"project_id":   existing.ProjectID,
		"title":        existing.Title,
		"bucket":       existing.Bucket,
		"position":     existing.Position,
		"tags":         existing.Tags,
		"attachments":  existing.Attachments,
		"body":         existing.Body,
		"due_date":     existing.DueDate,
		"planned_date": existing.PlannedDate,
		"priority":     existing.Priority,
		"color":        existing.Color,
		"created_at":   existing.CreatedAt,
		"updated_at":   existing.UpdatedAt,
	}

	nowStr := time.Now().UTC().Format(time.RFC3339Nano)
	nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

	taskMap := map[string]interface{}{
		"project_id":   projectID,
		"title":        existing.Title,
		"bucket":       req.Bucket,
		"position":     req.Position,
		"tags":         existing.Tags,
		"attachments":  existing.Attachments,
		"body":         existing.Body,
		"due_date":     existing.DueDate,
		"planned_date": existing.PlannedDate,
		"priority":     existing.Priority,
		"color":        existing.Color,
		"created_at":   existing.CreatedAt,
		"updated_at":   nowStr,
	}

	filename, errWrite := s.fileRepo.WriteTaskFile(tasksDir, taskID, taskMap)
	if errWrite != nil {
		return nil, fmt.Errorf("failed to write task file: %w", errWrite)
	}

	res := Response{
		ID:          taskID,
		ProjectID:   projectID,
		Title:       existing.Title,
		Bucket:      req.Bucket,
		Position:    req.Position,
		Tags:        existing.Tags,
		Attachments: existing.Attachments,
		Body:        existing.Body,
		DueDate:     existing.DueDate,
		PlannedDate: existing.PlannedDate,
		Priority:    existing.Priority,
		Color:       existing.Color,
		CreatedAt:   existing.CreatedAt,
		UpdatedAt:   nowStr,
	}

	if err := s.dbRepo.Update(ctx, projectID, res, filename); err != nil {
		// Rollback file on disk
		_, _ = s.fileRepo.WriteTaskFile(tasksDir, taskID, oldTaskMap)
		return nil, fmt.Errorf("failed to update database: %w", err)
	}

	if syncBucketsFunc != nil {
		if req.Bucket != existing.Bucket {
			_ = syncBucketsFunc(tasksDir, projectID)
		}
	}

	return &res, nil
}

func (s *taskService) DeleteTask(ctx context.Context, tasksDir string, projectID string, taskID string) error {
	existing, errRead := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if errRead != nil || existing.ProjectID != projectID {
		return fmt.Errorf("%w: task with ID %s not found in project '%s'", ErrTaskNotFound, taskID, projectID)
	}

	// Delete file (which deletes attachments dir too)
	success := s.fileRepo.DeleteTaskFile(tasksDir, taskID)
	if !success {
		return errors.New("failed to delete task file")
	}

	// Delete from DB
	if err := s.dbRepo.Delete(ctx, projectID, taskID); err != nil {
		// Rollback file on disk
		taskMap := map[string]interface{}{
			"project_id":   existing.ProjectID,
			"title":        existing.Title,
			"bucket":       existing.Bucket,
			"position":     existing.Position,
			"tags":         existing.Tags,
			"attachments":  existing.Attachments,
			"body":         existing.Body,
			"due_date":     existing.DueDate,
			"planned_date": existing.PlannedDate,
			"priority":     existing.Priority,
			"color":        existing.Color,
			"created_at":   existing.CreatedAt,
			"updated_at":   existing.UpdatedAt,
		}
		_, _ = s.fileRepo.WriteTaskFile(tasksDir, taskID, taskMap)
		return fmt.Errorf("failed to delete task from database: %w", err)
	}

	return nil
}

func (s *taskService) SaveAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string, file io.Reader) (*Response, error) {
	existing, errRead := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if errRead != nil || existing.ProjectID != projectID {
		return nil, fmt.Errorf("%w: task with ID %s not found in project '%s'", ErrTaskNotFound, taskID, projectID)
	}

	// Save attachment to disk folder
	if err := s.fileRepo.SaveAttachment(tasksDir, projectID, taskID, filename, file); err != nil {
		return nil, fmt.Errorf("failed to save attachment: %w", err)
	}

	found := false
	for _, a := range existing.Attachments {
		if a == filename {
			found = true
			break
		}
	}

	if !found {
		oldAttachments := existing.Attachments
		existing.Attachments = append(existing.Attachments, filename)

		taskMap := map[string]interface{}{
			"project_id":   existing.ProjectID,
			"title":        existing.Title,
			"bucket":       existing.Bucket,
			"position":     existing.Position,
			"tags":         existing.Tags,
			"attachments":  existing.Attachments,
			"body":         existing.Body,
			"due_date":     existing.DueDate,
			"planned_date": existing.PlannedDate,
			"priority":     existing.Priority,
			"color":        existing.Color,
			"created_at":   existing.CreatedAt,
			"updated_at":   existing.UpdatedAt,
		}

		if _, err := s.fileRepo.WriteTaskFile(tasksDir, taskID, taskMap); err != nil {
			// Rollback attachment addition on disk
			_ = s.fileRepo.DeleteAttachment(tasksDir, projectID, taskID, filename)
			return nil, fmt.Errorf("failed to update task file: %w", err)
		}

		if err := s.dbRepo.UpdateAttachments(ctx, projectID, taskID, existing.Attachments); err != nil {
			// Rollback everything
			oldTaskMap := map[string]interface{}{
				"project_id":   existing.ProjectID,
				"title":        existing.Title,
				"bucket":       existing.Bucket,
				"position":     existing.Position,
				"tags":         existing.Tags,
				"attachments":  oldAttachments,
				"body":         existing.Body,
				"due_date":     existing.DueDate,
				"planned_date": existing.PlannedDate,
				"priority":     existing.Priority,
				"color":        existing.Color,
				"created_at":   existing.CreatedAt,
				"updated_at":   existing.UpdatedAt,
			}
			_, _ = s.fileRepo.WriteTaskFile(tasksDir, taskID, oldTaskMap)
			_ = s.fileRepo.DeleteAttachment(tasksDir, projectID, taskID, filename)
			return nil, fmt.Errorf("failed to update database: %w", err)
		}
	}

	return existing, nil
}

func (s *taskService) DeleteAttachment(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (*Response, error) {
	existing, errRead := s.fileRepo.ReadTaskFile(tasksDir, taskID)
	if errRead != nil || existing.ProjectID != projectID {
		return nil, fmt.Errorf("%w: task with ID %s not found in project '%s'", ErrTaskNotFound, taskID, projectID)
	}

	found := false
	var newAtt []string
	for _, a := range existing.Attachments {
		if a == filename {
			found = true
		} else {
			newAtt = append(newAtt, a)
		}
	}

	if found {
		oldAttachments := existing.Attachments
		existing.Attachments = newAtt

		taskMap := map[string]interface{}{
			"project_id":   existing.ProjectID,
			"title":        existing.Title,
			"bucket":       existing.Bucket,
			"position":     existing.Position,
			"tags":         existing.Tags,
			"attachments":  existing.Attachments,
			"body":         existing.Body,
			"due_date":     existing.DueDate,
			"planned_date": existing.PlannedDate,
			"priority":     existing.Priority,
			"color":        existing.Color,
			"created_at":   existing.CreatedAt,
			"updated_at":   existing.UpdatedAt,
		}

		if _, err := s.fileRepo.WriteTaskFile(tasksDir, taskID, taskMap); err != nil {
			return nil, fmt.Errorf("failed to update task file: %w", err)
		}

		if err := s.dbRepo.UpdateAttachments(ctx, projectID, taskID, existing.Attachments); err != nil {
			// Rollback task file
			oldTaskMap := map[string]interface{}{
				"project_id":   existing.ProjectID,
				"title":        existing.Title,
				"bucket":       existing.Bucket,
				"position":     existing.Position,
				"tags":         existing.Tags,
				"attachments":  oldAttachments,
				"body":         existing.Body,
				"due_date":     existing.DueDate,
				"planned_date": existing.PlannedDate,
				"priority":     existing.Priority,
				"color":        existing.Color,
				"created_at":   existing.CreatedAt,
				"updated_at":   existing.UpdatedAt,
			}
			_, _ = s.fileRepo.WriteTaskFile(tasksDir, taskID, oldTaskMap)
			return nil, fmt.Errorf("failed to update database: %w", err)
		}

		// Delete physical file ONLY after metadata updates succeed
		_ = s.fileRepo.DeleteAttachment(tasksDir, projectID, taskID, filename)
	}

	return existing, nil
}

func (s *taskService) GetAttachmentPath(ctx context.Context, tasksDir string, projectID string, taskID string, filename string) (string, error) {
	filePath := s.fileRepo.GetAttachmentPath(tasksDir, projectID, taskID, filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", os.ErrNotExist
	}
	return filePath, nil
}
