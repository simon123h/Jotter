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

type Handler struct {
	tasksDir        string
	defaultBuckets  []map[string]interface{}
	syncBucketsFunc func(string, string) error
	svc             Service
}

// RegisterRoutes registers the project sub-routes.
func RegisterRoutes(r chi.Router, tasksDir string, defaultBuckets []map[string]interface{}, syncBucketsFunc func(string, string) error) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	svc := NewService(dbRepo, fileRepo)
	h := &Handler{
		tasksDir:        tasksDir,
		defaultBuckets:  defaultBuckets,
		syncBucketsFunc: syncBucketsFunc,
		svc:             svc,
	}

	r.Get("/projects", h.GetProjects)
	r.Post("/projects", h.CreateProject)
	r.Put("/projects/{project_id}", h.UpdateProject)
	r.Delete("/projects/{project_id}", h.DeleteProject)
}

// GetProjects godoc
// @Summary      Get all projects
// @Description  Get a list of all active projects
// @Tags         projects
// @Produce      json
// @Success      200  {array}   Response
// @Failure      500  {object}  common.ErrorResponse
// @Router       /projects [get]
func (h *Handler) GetProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := h.svc.GetProjects(r.Context())
	if err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	common.SendJSON(w, http.StatusOK, projects)
}

// CreateProject godoc
// @Summary      Create a new project
// @Description  Create a new workspace project board with default buckets
// @Tags         projects
// @Accept       json
// @Produce      json
// @Param        project  body      Create  true  "Create Project Request"
// @Success      201      {object}  Response
// @Failure      400      {object}  common.ErrorResponse
// @Failure      500      {object}  common.ErrorResponse
// @Router       /projects [post]
func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req Create
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	res, err := h.svc.CreateProject(r.Context(), h.tasksDir, req, h.defaultBuckets, h.syncBucketsFunc)
	if err != nil {
		if errors.Is(err, ErrDuplicateProject) || errors.Is(err, ErrInvalidInput) {
			common.SendError(w, http.StatusBadRequest, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusCreated, res)
}

// UpdateProject godoc
// @Summary      Update a project
// @Description  Update project metadata (title, clean period, or Git remote)
// @Tags         projects
// @Accept       json
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Param        project     body      Update  true  "Update Project Request"
// @Success      200         {object}  Response
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id} [put]
func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
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

	res, err := h.svc.UpdateProject(r.Context(), h.tasksDir, projectID, raw, req)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			common.SendError(w, http.StatusNotFound, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, res)
}

// DeleteProject godoc
// @Summary      Delete a project
// @Description  Delete a project board and remove its local database cache index entries
// @Tags         projects
// @Produce      json
// @Param        project_id  path      string  true  "Project ID"
// @Success      200         {object}  map[string]string
// @Failure      400         {object}  common.ErrorResponse
// @Failure      404         {object}  common.ErrorResponse
// @Failure      500         {object}  common.ErrorResponse
// @Router       /projects/{project_id} [delete]
func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "project_id")

	err := h.svc.DeleteProject(r.Context(), h.tasksDir, projectID)
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
}
