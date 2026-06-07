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

// RegisterRoutes registers the task sub-routes.
// It internally bootstraps the layered architecture for the task feature,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)

	r.Get("/tasks", func(w http.ResponseWriter, r *http.Request) {
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

		taskList, err := svc.GetTasks(r.Context(), filter)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		common.SendJSON(w, http.StatusOK, taskList)
	})

	r.Get("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
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

		taskList, err := svc.GetTasks(r.Context(), filter)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusOK, taskList)
	})

	r.Post("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
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

		res, err := svc.CreateTask(r.Context(), tasksDir, projectID, req)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) || errors.Is(err, ErrInvalidInput) {
				common.SendError(w, http.StatusBadRequest, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusCreated, res)
	})

	r.Route("/projects/{project_id}/tasks/{task_id}", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			taskID := chi.URLParam(r, "task_id")
			res, err := svc.GetTaskByID(r.Context(), tasksDir, taskID)
			if err != nil {
				common.SendError(w, http.StatusNotFound, err.Error())
				return
			}
			common.SendJSON(w, http.StatusOK, res)
		})

		r.Delete("/", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			err := svc.DeleteTask(r.Context(), tasksDir, projectID, taskID)
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
		})

		updateHandler := func(w http.ResponseWriter, r *http.Request) {
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

			res, err := svc.UpdateTask(r.Context(), tasksDir, projectID, taskID, raw, req, bucket.SyncBucketsFile)
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

		r.Put("/", updateHandler)
		r.Patch("/", updateHandler)

		// --- Attachment Endpoints ---
		r.Post("/attachments", func(w http.ResponseWriter, r *http.Request) {
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

			res, err := svc.SaveAttachment(r.Context(), tasksDir, projectID, taskID, header.Filename, file)
			if err != nil {
				if errors.Is(err, ErrTaskNotFound) {
					common.SendError(w, http.StatusNotFound, err.Error())
				} else {
					common.SendError(w, http.StatusInternalServerError, err.Error())
				}
				return
			}

			common.SendJSON(w, http.StatusOK, res)
		})

		r.Get("/attachments/{filename}", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")
			filename := chi.URLParam(r, "filename")

			filePath, err := svc.GetAttachmentPath(r.Context(), tasksDir, projectID, taskID, filename)
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					http.NotFound(w, r)
				} else {
					common.SendError(w, http.StatusInternalServerError, err.Error())
				}
				return
			}

			http.ServeFile(w, r, filePath)
		})

		r.Delete("/attachments/{filename}", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")
			filename := chi.URLParam(r, "filename")

			res, err := svc.DeleteAttachment(r.Context(), tasksDir, projectID, taskID, filename)
			if err != nil {
				if errors.Is(err, ErrTaskNotFound) {
					common.SendError(w, http.StatusNotFound, err.Error())
				} else {
					common.SendError(w, http.StatusInternalServerError, err.Error())
				}
				return
			}

			common.SendJSON(w, http.StatusOK, res)
		})
	})

	r.Patch("/projects/{project_id}/tasks/{task_id}/move", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		taskID := chi.URLParam(r, "task_id")

		var req Move
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		res, err := svc.MoveTask(r.Context(), tasksDir, projectID, taskID, req, bucket.SyncBucketsFile)
		if err != nil {
			if errors.Is(err, ErrTaskNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusOK, res)
	})
}
