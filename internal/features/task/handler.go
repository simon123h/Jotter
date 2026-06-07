package task

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/common"
)

type Handler struct {
	tasksDir string
	svc      Service
}

// RegisterRoutes registers the task sub-routes.
// It internally bootstraps the layered architecture for the task feature,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)
	h := &Handler{
		tasksDir: tasksDir,
		svc:      svc,
	}

	r.Get("/tasks", h.GetGlobalTasks)
	r.Get("/projects/{project_id}/tasks", h.GetProjectTasks)
	r.Post("/projects/{project_id}/tasks", h.CreateTask)

	r.Route("/projects/{project_id}/tasks/{task_id}", func(r chi.Router) {
		r.Get("/", h.GetTaskByID)
		r.Delete("/", h.DeleteTask)
		r.Put("/", h.UpdateTask)
		r.Patch("/", h.UpdateTask)

		// --- Attachment Endpoints ---
		r.Post("/attachments", h.UploadAttachment)
		r.Get("/attachments/{filename}", h.GetAttachment)
		r.Delete("/attachments/{filename}", h.DeleteAttachment)
	})

	r.Patch("/projects/{project_id}/tasks/{task_id}/move", h.MoveTask)
}

// GetGlobalTasks godoc
// @Summary      Get all tasks across all projects
// @Description  Retrieve tasks across all projects with filters (e.g. exclude certain buckets)
// @Tags         tasks
// @Produce      json
// @Param        exclude_buckets  query     string  false  "Comma-separated list of bucket names to exclude"
// @Success      200              {array}   Response
// @Failure      500              {object}  common.ErrorResponse
// @Router       /tasks [get]
func (h *Handler) GetGlobalTasks(w http.ResponseWriter, r *http.Request) {
	var excludeBuckets []string
	excludeBucketsParam := r.URL.Query().Get("exclude_buckets")
	if excludeBucketsParam != "" {
		for _, b := range strings.Split(excludeBucketsParam, ",") {
			excludeBuckets = append(excludeBuckets, strings.TrimSpace(b))
		}
	}

	filter := TaskFilter{
		ExcludeBuckets: excludeBuckets,
	}

	taskList, err := h.svc.GetTasks(r.Context(), filter)
	if err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	common.SendJSON(w, http.StatusOK, taskList)
}

// GetProjectTasks godoc
// @Summary      Get tasks of a specific project
// @Description  Retrieve tasks for the specified project, with support for filtering by bucket, excluding buckets, and priorities
// @Tags         tasks
// @Produce      json
// @Param        project_id       path      string  true   "Project ID"
// @Param        bucket           query     string  false  "Filter by bucket name"
// @Param        exclude_bucket   query     string  false  "Exclude specific bucket"
// @Param        exclude_buckets  query     string  false  "Comma-separated list of bucket names to exclude"
// @Param        priorities       query     string  false  "Comma-separated list of priorities to filter by"
// @Success      200              {array}   Response
// @Failure      404              {object}  common.ErrorResponse
// @Failure      500              {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks [get]
func (h *Handler) GetProjectTasks(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")

	bucketName := r.URL.Query().Get("bucket")
	excludeBucket := r.URL.Query().Get("exclude_bucket")

	var excludeBuckets []string
	excludeBucketsParam := r.URL.Query().Get("exclude_buckets")
	if excludeBucketsParam != "" {
		for _, b := range strings.Split(excludeBucketsParam, ",") {
			excludeBuckets = append(excludeBuckets, strings.TrimSpace(b))
		}
	}

	var priorities []string
	prioritiesParam := r.URL.Query().Get("priorities")
	if prioritiesParam != "" {
		for _, p := range strings.Split(prioritiesParam, ",") {
			priorities = append(priorities, strings.TrimSpace(p))
		}
	}

	filter := TaskFilter{
		ProjectID:      projectID,
		Bucket:         bucketName,
		ExcludeBucket:  excludeBucket,
		ExcludeBuckets: excludeBuckets,
		Priorities:     priorities,
	}

	taskList, err := h.svc.GetTasks(r.Context(), filter)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, taskList)
}

// CreateTask godoc
// @Summary      Create a new task
// @Description  Create a new task under the specified project and bucket
// @Tags         tasks
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task        body      Create  true  "Create Task Request"
// @Success      201         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks [post]
func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")

	if r.Body == nil {
		common.SendError(w, http.StatusBadRequest, "Request body is missing")
		return
	}

	var req Create
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.CreateTask(r.Context(), h.tasksDir, projectID, req)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) || errors.Is(err, ErrInvalidInput) {
			common.SendError(w, http.StatusBadRequest, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusCreated, res)
}

// GetTaskByID godoc
// @Summary      Get task by ID
// @Description  Retrieve detailed information about a specific task by its ID
// @Tags         tasks
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Success      200         {object}  Response
// @Failure      404         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id} [get]
func (h *Handler) GetTaskByID(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "task_id")
	res, err := h.svc.GetTaskByID(r.Context(), h.tasksDir, taskID)
	if err != nil {
		common.SendError(w, http.StatusNotFound, err.Error())
		return
	}
	common.SendJSON(w, http.StatusOK, res)
}

// DeleteTask godoc
// @Summary      Delete a task
// @Description  Delete a task by ID, including its markdown file and index
// @Tags         tasks
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Success      200         {object}  map[string]string
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id} [delete]
func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")

	err := h.svc.DeleteTask(r.Context(), h.tasksDir, projectID, taskID)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, map[string]string{
		"status": "success",
		"detail": fmt.Sprintf("Task %s deleted", taskID),
	})
}

// UpdateTask godoc
// @Summary      Update a task
// @Description  Update a task's fields or metadata. Supports both PUT and PATCH behaviors.
// @Tags         tasks
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Param        task        body      Update  true  "Update Task Request"
// @Success      200         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id} [put]
func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		common.SendError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	var req Update
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.UpdateTask(r.Context(), h.tasksDir, projectID, taskID, raw, req, bucket.SyncBucketsFile)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else if errors.Is(err, ErrInvalidInput) {
			common.SendError(w, http.StatusBadRequest, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}

// UploadAttachment godoc
// @Summary      Upload an attachment to a task
// @Description  Upload a file as an attachment to the specified task (multipart/form-data)
// @Tags         tasks
// @Accept       multipart/form-data
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Param        file        formData  file    true  "File to upload"
// @Success      200         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id}/attachments [post]
func (h *Handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")

	err := r.ParseMultipartForm(32 << 20) // 32MB max
	if err != nil {
		common.SendError(w, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		common.SendError(w, http.StatusBadRequest, "No file provided")
		return
	}
	defer file.Close()

	res, err := h.svc.SaveAttachment(r.Context(), h.tasksDir, projectID, taskID, header.Filename, file)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}

// GetAttachment godoc
// @Summary      Get task attachment file
// @Description  Serve/download the specified attachment file of a task
// @Tags         tasks
// @Produce      octet-stream
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Param        filename    path      string  true  "Attachment file name"
// @Success      200         {file}    binary
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id}/attachments/{filename} [get]
func (h *Handler) GetAttachment(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")
	filename := chi.URLParam(r, "filename")

	filePath, err := h.svc.GetAttachmentPath(r.Context(), h.tasksDir, projectID, taskID, filename)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	http.ServeFile(w, r, filePath)
}

// DeleteAttachment godoc
// @Summary      Delete task attachment
// @Description  Delete the specified attachment file of a task
// @Tags         tasks
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Param        filename    path      string  true  "Attachment file name"
// @Success      200         {object}  Response
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id}/attachments/{filename} [delete]
func (h *Handler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")
	filename := chi.URLParam(r, "filename")

	res, err := h.svc.DeleteAttachment(r.Context(), h.tasksDir, projectID, taskID, filename)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}

// MoveTask godoc
// @Summary      Move/reorder a task
// @Description  Move a task to a different bucket or change its relative position
// @Tags         tasks
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        task_id     path      string  true  "Task ID"
// @Param        move        body      Move    true  "Move Task Request"
// @Success      200         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/tasks/{task_id}/move [patch]
func (h *Handler) MoveTask(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	taskID := chi.URLParam(r, "task_id")

	var req Move
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.MoveTask(r.Context(), h.tasksDir, projectID, taskID, req, bucket.SyncBucketsFile)
	if err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}
