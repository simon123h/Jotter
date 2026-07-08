package task

import (
	"context"
	"testing"
	"time"
)

func TestService_MoveTask_Postpone(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id": "p1",
				"title":      "Task 1",
				"bucket":     "todo",
				"position":   100.0,
				"tags":       []string{},
				"body":       "",
				"created_at": "2023-01-01T00:00:00Z",
				"updated_at": "2023-01-01T00:00:00Z",
			},
		},
	}
	svc := NewService(dbRepo, fileRepo)

	// 1. Move to postponed (no date provided) -> should default to tomorrow
	res, err := svc.MoveTask(context.Background(), "tasks_dir", "p1", "t1", Move{Bucket: "postponed", Position: 200.0}, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// The actual database/file bucket should remain "todo"
	if res.Bucket != "todo" {
		t.Errorf("Expected database bucket to remain 'todo', got '%s'", res.Bucket)
	}

	// PostponedUntil should be set to tomorrow
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if res.PostponedUntil == nil || *res.PostponedUntil != tomorrow {
		t.Errorf("Expected PostponedUntil to be '%s', got '%v'", tomorrow, res.PostponedUntil)
	}

	// 2. Move to a normal column (e.g. "in-progress") -> should clear postponed_until
	res2, err := svc.MoveTask(context.Background(), "tasks_dir", "p1", "t1", Move{Bucket: "in-progress", Position: 200.0}, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if res2.Bucket != "in-progress" {
		t.Errorf("Expected database bucket to become 'in-progress', got '%s'", res2.Bucket)
	}

	if res2.PostponedUntil != nil {
		t.Errorf("Expected PostponedUntil to be nil, got '%v'", *res2.PostponedUntil)
	}
}

func TestService_UpdateTask_Postpone(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id": "p1",
				"title":      "Task 1",
				"bucket":     "todo",
				"position":   100.0,
				"tags":       []string{},
				"body":       "",
				"created_at": "2023-01-01T00:00:00Z",
				"updated_at": "2023-01-01T00:00:00Z",
			},
		},
	}
	svc := NewService(dbRepo, fileRepo)

	// 1. Update task, setting column to "postponed" with a custom date
	customDate := "2026-08-01"
	bucketVal := "postponed"
	rawUpdate := map[string]interface{}{
		"bucket":          bucketVal,
		"postponed_until": customDate,
	}
	reqUpdate := Update{
		Bucket:         &bucketVal,
		PostponedUntil: &customDate,
	}

	res, err := svc.UpdateTask(context.Background(), "tasks_dir", "p1", "t1", rawUpdate, reqUpdate, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Actual bucket should be unchanged ("todo")
	if res.Bucket != "todo" {
		t.Errorf("Expected database bucket to remain 'todo', got '%s'", res.Bucket)
	}

	// PostponedUntil should be the custom date
	if res.PostponedUntil == nil || *res.PostponedUntil != customDate {
		t.Errorf("Expected PostponedUntil to be '%s', got '%v'", customDate, res.PostponedUntil)
	}

	// 2. Update task, moving it to "in-progress" -> should clear postponed_until
	inProgressBucket := "in-progress"
	rawUpdate2 := map[string]interface{}{
		"bucket": inProgressBucket,
	}
	reqUpdate2 := Update{
		Bucket: &inProgressBucket,
	}

	res2, err := svc.UpdateTask(context.Background(), "tasks_dir", "p1", "t1", rawUpdate2, reqUpdate2, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if res2.Bucket != "in-progress" {
		t.Errorf("Expected database bucket to be 'in-progress', got '%s'", res2.Bucket)
	}

	if res2.PostponedUntil != nil {
		t.Errorf("Expected PostponedUntil to be nil, got '%v'", *res2.PostponedUntil)
	}
}
