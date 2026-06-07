package project

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
)

// RegisterRoutes registers the project sub-routes.
// It internally bootstraps the layered architecture for the project feature,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string, defaultBuckets []map[string]interface{}, syncBucketsFunc func(string, string) error) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)

	r.Get("/projects", func(w http.ResponseWriter, r *http.Request) {
		projects, err := svc.GetProjects(r.Context())
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		common.SendJSON(w, http.StatusOK, projects)
	})

	r.Post("/projects", func(w http.ResponseWriter, r *http.Request) {
		var req Create
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		res, err := svc.CreateProject(r.Context(), tasksDir, req, defaultBuckets, syncBucketsFunc)
		if err != nil {
			if errors.Is(err, ErrDuplicateProject) || errors.Is(err, ErrInvalidInput) {
				common.SendError(w, http.StatusBadRequest, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusCreated, res)
	})

	r.Put("/projects/{project_id}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

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

		res, err := svc.UpdateProject(r.Context(), tasksDir, projectID, raw, req)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusOK, res)
	})

	r.Delete("/projects/{project_id}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		err := svc.DeleteProject(r.Context(), tasksDir, projectID)
		if err != nil {
			if errors.Is(err, ErrProjectNotFound) {
				common.SendError(w, http.StatusNotFound, err.Error())
			} else if errors.Is(err, ErrLastProject) {
				common.SendError(w, http.StatusBadRequest, err.Error())
			} else {
				common.SendError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		common.SendJSON(w, http.StatusOK, map[string]string{
			"status": "success",
			"detail": fmt.Sprintf("Project '%s' deleted", projectID),
		})
	})
}
