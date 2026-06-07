package task

import (
	"context"
	"errors"
	"io"
	"path/filepath"
	"strings"
	"testing"
)

type mockDBRepository struct {
	tasks              map[string]Response
	projectExistsMap   map[string]bool
	maxTaskPosMap      map[string]float64
	createErr          error
	updateErr          error
	deleteErr          error
	updateAttErr       error
	createdTasks       []Response
	updatedTasks       []Response
	deletedTasks       []string
	updatedAttachments map[string][]string
}

func (m *mockDBRepository) GetTasks(ctx context.Context, filter TaskFilter) ([]Response, error) {
	var list []Response
	for _, t := range m.tasks {
		if filter.ProjectID != "" && t.ProjectID != filter.ProjectID {
			continue
		}
		if filter.Bucket != "" && t.Bucket != filter.Bucket {
			continue
		}
		list = append(list, t)
	}
	return list, nil
}

func (m *mockDBRepository) ProjectExists(ctx context.Context, projectID string) (bool, error) {
	return m.projectExistsMap[projectID], nil
}

func (m *mockDBRepository) GetMaxTaskPosition(ctx context.Context, projectID string, bucket string) (float64, error) {
	return m.maxTaskPosMap[projectID+"-"+bucket], nil
}

func (m *mockDBRepository) Create(ctx context.Context, task Response, filename string) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.createdTasks = append(m.createdTasks, task)
	m.tasks[task.ID] = task
	return nil
}

func (m *mockDBRepository) Update(ctx context.Context, oldProjectID string, task Response, filename string) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.updatedTasks = append(m.updatedTasks, task)
	m.tasks[task.ID] = task
	return nil
}

func (m *mockDBRepository) Delete(ctx context.Context, projectID string, taskID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	m.deletedTasks = append(m.deletedTasks, taskID)
	delete(m.tasks, taskID)
	return nil
}

func (m *mockDBRepository) UpdateAttachments(ctx context.Context, projectID string, taskID string, attachments []string) error {
	if m.updateAttErr != nil {
		return m.updateAttErr
	}
	if m.updatedAttachments == nil {
		m.updatedAttachments = make(map[string][]string)
	}
	m.updatedAttachments[taskID] = attachments
	if t, ok := m.tasks[taskID]; ok {
		t.Attachments = attachments
		m.tasks[taskID] = t
	}
	return nil
}

type mockFileRepository struct {
	tasks              map[string]map[string]interface{}
	attachments        map[string][]string
	readErr            error
	writeErr           error
	deleteErr          bool
	saveAttErr         error
	deleteAttErr       error
	writtenFiles       map[string]map[string]interface{}
	deletedFiles       []string
	savedAttachments   []string
	deletedAttachments []string
}

func (m *mockFileRepository) GetTaskFilePath(tasksDir string, taskID string) (filePath string, filename string, projectID string, err error) {
	if t, ok := m.tasks[taskID]; ok {
		pID := t["project_id"].(string)
		return filepath.Join(tasksDir, pID, taskID+".md"), taskID+".md", pID, nil
	}
	return "", "", "", errors.New("file not found")
}

func (m *mockFileRepository) ReadTaskFile(tasksDir string, taskID string) (*Response, error) {
	if m.readErr != nil {
		return nil, m.readErr
	}
	if t, ok := m.tasks[taskID]; ok {
		var tags, attachments []string
		if tg, ok := t["tags"].([]string); ok {
			tags = tg
		}
		if att, ok := t["attachments"].([]string); ok {
			attachments = att
		}

		var dueDate, plannedDate, priority, color *string
		if d, ok := t["due_date"].(*string); ok {
			dueDate = d
		}
		if p, ok := t["planned_date"].(*string); ok {
			plannedDate = p
		}
		if pr, ok := t["priority"].(*string); ok {
			priority = pr
		}
		if cl, ok := t["color"].(*string); ok {
			color = cl
		}

		return &Response{
			ID:          taskID,
			ProjectID:   t["project_id"].(string),
			Title:       t["title"].(string),
			Bucket:      t["bucket"].(string),
			Position:    t["position"].(float64),
			Tags:        tags,
			Attachments: attachments,
			Body:        t["body"].(string),
			DueDate:     dueDate,
			PlannedDate: plannedDate,
			Priority:    priority,
			Color:       color,
			CreatedAt:   t["created_at"].(string),
			UpdatedAt:   t["updated_at"].(string),
		}, nil
	}
	return nil, errors.New("file not found")
}

func (m *mockFileRepository) WriteTaskFile(tasksDir string, taskID string, taskData map[string]interface{}) (string, error) {
	if m.writeErr != nil {
		return "", m.writeErr
	}
	if m.writtenFiles == nil {
		m.writtenFiles = make(map[string]map[string]interface{})
	}
	m.writtenFiles[taskID] = taskData
	m.tasks[taskID] = taskData
	return taskID + ".md", nil
}

func (m *mockFileRepository) DeleteTaskFile(tasksDir string, taskID string) bool {
	if m.deleteErr {
		return false
	}
	m.deletedFiles = append(m.deletedFiles, taskID)
	delete(m.tasks, taskID)
	return true
}

func (m *mockFileRepository) SaveAttachment(tasksDir string, projectID string, taskID string, filename string, file io.Reader) error {
	if m.saveAttErr != nil {
		return m.saveAttErr
	}
	m.savedAttachments = append(m.savedAttachments, taskID+"-"+filename)
	m.attachments[taskID] = append(m.attachments[taskID], filename)
	return nil
}

func (m *mockFileRepository) DeleteAttachment(tasksDir string, projectID string, taskID string, filename string) error {
	if m.deleteAttErr != nil {
		return m.deleteAttErr
	}
	m.deletedAttachments = append(m.deletedAttachments, taskID+"-"+filename)
	var list []string
	for _, a := range m.attachments[taskID] {
		if a != filename {
			list = append(list, a)
		}
	}
	m.attachments[taskID] = list
	return nil
}

func (m *mockFileRepository) GetAttachmentPath(tasksDir string, projectID string, taskID string, filename string) string {
	return filepath.Join(tasksDir, projectID, taskID+".attachments", filename)
}

func TestCreateTask_Success(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
	}
	fileRepo := &mockFileRepository{
		tasks: make(map[string]map[string]interface{}),
	}
	svc := NewService(dbRepo, fileRepo)

	req := Create{
		Title:  "Hello Task",
		Bucket: "todo",
		Tags:   []string{"High", "Tech"},
		Body:   "Body of task",
	}

	res, err := svc.CreateTask(context.Background(), "tasks_dir", "p1", req)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if res.Title != "Hello Task" || res.Bucket != "todo" || res.ProjectID != "p1" {
		t.Errorf("Unexpected result: %+v", res)
	}

	// Verify both DB and File repos called
	if len(dbRepo.createdTasks) != 1 {
		t.Error("Expected DB Create to be called")
	}
	if len(fileRepo.writtenFiles) != 1 {
		t.Error("Expected File Write to be called")
	}
}

func TestCreateTask_RollbackOnFileDBFailure(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
		createErr:        errors.New("db crash"),
	}
	fileRepo := &mockFileRepository{
		tasks: make(map[string]map[string]interface{}),
	}
	svc := NewService(dbRepo, fileRepo)

	req := Create{
		Title:  "Hello Task",
		Bucket: "todo",
	}

	_, err := svc.CreateTask(context.Background(), "tasks_dir", "p1", req)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	// Strategy A: DB write failed. Verify file deleted!
	if len(fileRepo.deletedFiles) != 1 {
		t.Error("Expected file to be cleaned up after DB write failed")
	}
}

func TestUpdateTask_Success(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id": "p1",
				"title":      "Old Title",
				"bucket":     "todo",
				"position":   100.0,
				"tags":       []string{"t1"},
				"body":       "Old Body",
				"created_at": "2023-01-01T00:00:00Z",
				"updated_at": "2023-01-01T00:00:00Z",
			},
		},
	}
	svc := NewService(dbRepo, fileRepo)

	newTitle := "New Title"
	rawUpdate := map[string]interface{}{
		"title": newTitle,
	}
	reqUpdate := Update{
		Title: &newTitle,
	}

	res, err := svc.UpdateTask(context.Background(), "tasks_dir", "p1", "t1", rawUpdate, reqUpdate, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if res.Title != "New Title" || res.Body != "Old Body" {
		t.Errorf("Unexpected result: %+v", res)
	}
}

func TestUpdateTask_RollbackOnDBFailure(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
		updateErr:        errors.New("db error"),
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id": "p1",
				"title":      "Old Title",
				"bucket":     "todo",
				"position":   100.0,
				"tags":       []string{"t1"},
				"body":       "Old Body",
				"created_at": "2023-01-01T00:00:00Z",
				"updated_at": "2023-01-01T00:00:00Z",
			},
		},
	}
	svc := NewService(dbRepo, fileRepo)

	newTitle := "New Title"
	rawUpdate := map[string]interface{}{
		"title": newTitle,
	}
	reqUpdate := Update{
		Title: &newTitle,
	}

	_, err := svc.UpdateTask(context.Background(), "tasks_dir", "p1", "t1", rawUpdate, reqUpdate, nil)
	if err == nil {
		t.Fatal("Expected update error")
	}

	// Strategy A: DB write failed. Verify file was rolled back to "Old Title"
	rolledBackData, ok := fileRepo.writtenFiles["t1"]
	if !ok {
		t.Fatal("Expected write task file to be called to rollback")
	}
	if rolledBackData["title"].(string) != "Old Title" {
		t.Errorf("Expected title rolled back to 'Old Title', got %q", rolledBackData["title"])
	}
}

func TestDeleteTask_RollbackOnDBFailure(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
		deleteErr:        errors.New("failed to delete SQL"),
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id": "p1",
				"title":      "Task 1",
				"bucket":     "todo",
				"position":   100.0,
				"tags":       []string{"t1"},
				"body":       "Body",
				"created_at": "2023-01-01T00:00:00Z",
				"updated_at": "2023-01-01T00:00:00Z",
			},
		},
	}
	svc := NewService(dbRepo, fileRepo)

	err := svc.DeleteTask(context.Background(), "tasks_dir", "p1", "t1")
	if err == nil {
		t.Fatal("Expected error")
	}

	// Strategy A: DB delete failed. Verify task file was restored!
	restoredTask, ok := fileRepo.tasks["t1"]
	if !ok {
		t.Fatal("Expected file to be restored on disk after SQL error")
	}
	if restoredTask["title"].(string) != "Task 1" {
		t.Errorf("Expected title to be 'Task 1', got %q", restoredTask["title"])
	}
}

func TestSaveAttachment_RollbackOnDBFailure(t *testing.T) {
	dbRepo := &mockDBRepository{
		tasks:            make(map[string]Response),
		projectExistsMap: map[string]bool{"p1": true},
		updateAttErr:     errors.New("db error"),
	}
	fileRepo := &mockFileRepository{
		tasks: map[string]map[string]interface{}{
			"t1": {
				"project_id":  "p1",
				"title":       "Task 1",
				"bucket":      "todo",
				"position":    100.0,
				"tags":        []string{},
				"attachments": []string{},
				"body":        "Body",
				"created_at":  "2023-01-01T00:00:00Z",
				"updated_at":  "2023-01-01T00:00:00Z",
			},
		},
		attachments: make(map[string][]string),
	}
	svc := NewService(dbRepo, fileRepo)

	_, err := svc.SaveAttachment(context.Background(), "tasks_dir", "p1", "t1", "doc.pdf", strings.NewReader("pdf data"))
	if err == nil {
		t.Fatal("Expected error")
	}

	// Strategy A: DB update failed. Verify attachment file was deleted!
	if len(fileRepo.deletedAttachments) != 1 || fileRepo.deletedAttachments[0] != "t1-doc.pdf" {
		t.Error("Expected attachment file to be cleaned up")
	}

	// Verify task file attachments list rolled back to empty
	rolledBackTask := fileRepo.writtenFiles["t1"]
	attList := rolledBackTask["attachments"].([]string)
	if len(attList) != 0 {
		t.Errorf("Expected empty attachments in task file, got %v", attList)
	}
}
