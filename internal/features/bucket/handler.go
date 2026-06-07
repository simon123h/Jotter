package bucket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
)

type Handler struct {
	tasksDir string
	svc      Service
}

// RegisterRoutes registers the columns (buckets) sub-routes.
// It internally bootstraps the layered architecture for the bucket feature,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)
	h := &Handler{
		tasksDir: tasksDir,
		svc:      svc,
	}

	r.Get("/projects/{project_id}/buckets", h.GetBuckets)
	r.Post("/projects/{project_id}/buckets", h.CreateBucket)
	r.Put("/projects/{project_id}/buckets/{name}", h.UpdateBucket)
	r.Delete("/projects/{project_id}/buckets/{name}", h.DeleteBucket)
}

// GetBuckets godoc
// @Summary      Get all buckets of a project
// @Description  Get a list of all columns/buckets for the specified project
// @Tags         buckets
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Success      200         {array}   Response
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/buckets [get]
func (h *Handler) GetBuckets(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")

	buckets, err := h.svc.GetBuckets(r.Context(), projectID)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	common.SendJSON(w, http.StatusOK, buckets)
}

// CreateBucket godoc
// @Summary      Create a new bucket
// @Description  Create a new column/bucket in the specified project
// @Tags         buckets
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        bucket      body      Create  true  "Create Bucket Request"
// @Success      201         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/buckets [post]
func (h *Handler) CreateBucket(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")

	var req Create
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.CreateBucket(r.Context(), h.tasksDir, projectID, req)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else if errors.Is(err, ErrDuplicateBucket) || errors.Is(err, ErrInvalidInput) {
			common.SendError(w, http.StatusBadRequest, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusCreated, res)
}

// UpdateBucket godoc
// @Summary      Update a bucket
// @Description  Update metadata or position of a bucket/column
// @Tags         buckets
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        name        path      string  true  "Bucket Name (slug)"
// @Param        bucket      body      Update  true  "Update Bucket Request"
// @Success      200         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/buckets/{name} [put]
func (h *Handler) UpdateBucket(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	name := chi.URLParam(r, "name")

	var req Update
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.UpdateBucket(r.Context(), h.tasksDir, projectID, name, req)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) || errors.Is(err, ErrBucketNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}

// DeleteBucket godoc
// @Summary      Delete a bucket
// @Description  Delete a column/bucket from the project. The column must be empty.
// @Tags         buckets
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        name        path      string  true  "Bucket Name (slug)"
// @Success      200         {object}  map[string]string
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id}/buckets/{name} [delete]
func (h *Handler) DeleteBucket(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")
	name := chi.URLParam(r, "name")

	err := h.svc.DeleteBucket(r.Context(), h.tasksDir, projectID, name)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) || errors.Is(err, ErrBucketNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else if errors.Is(err, ErrBucketNotEmpty) {
			common.SendError(w, http.StatusBadRequest, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, map[string]string{
		"status": "success",
		"detail": fmt.Sprintf("Column '%s' deleted", name),
	})
}

// SyncBucketsFile queries the current SQL database state for a project's buckets
// and writes them down to the buckets.json file.
// Kept at package-level for project creation bootstrapping backwards compatibility.
func SyncBucketsFile(tasksDir string, projectID string) error {
	dbRepo := NewSQLRepository(db.DB)
	buckets, err := dbRepo.GetAll(context.Background(), projectID)
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

	return WriteBucketsFile(tasksDir, projectID, jsonBuckets)
}
