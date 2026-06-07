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

// RegisterRoutes registers the columns (buckets) sub-routes.
// It internally bootstraps the layered architecture for the bucket feature,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)

	r.Get("/projects/{project_id}/buckets", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		buckets, err := svc.GetBuckets(r.Context(), projectID)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}
		common.SendJSON(w, http.StatusOK, buckets)
	})

	r.Post("/projects/{project_id}/buckets", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		var req Create
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		res, err := svc.CreateBucket(r.Context(), tasksDir, projectID, req)
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
	})

	r.Put("/projects/{project_id}/buckets/{name}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		name := chi.URLParam(r, "name")

		var req Update
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		res, err := svc.UpdateBucket(r.Context(), tasksDir, projectID, name, req)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) || errors.Is(err, ErrBucketNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusOK, res)
	})

	r.Delete("/projects/{project_id}/buckets/{name}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		name := chi.URLParam(r, "name")

		err := svc.DeleteBucket(r.Context(), tasksDir, projectID, name)
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
