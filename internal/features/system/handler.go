package system

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
	"jotter/backend/internal/features/settings"
)

type Handler struct {
	svc      Service
	tasksDir string
	version  string
}

func RegisterRoutes(r chi.Router, tasksDir string, version string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	settingsRepo := settings.NewFileRepository()
	svc := NewService(dbRepo, fileRepo, settingsRepo)
	h := &Handler{svc: svc, tasksDir: tasksDir, version: version}

	r.Post("/system/sync", h.Sync)
	r.Get("/system/info", h.GetInfo)
	r.Get("/system/history", h.GetHistory)
	r.Post("/system/restore", h.Restore)
}

// Sync godoc
// @Summary      Synchronize system index and Git
// @Description  Trigger a complete bidirectional sync. It parses task markdown files to rebuild the SQLite DB index, and fetches/merges/pushes active Git remotes.
// @Tags         system
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      409  {object}  common.ErrorResponse
// @Failure      500  {object}  common.ErrorResponse
// @Router       /system/sync [post]
func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.Sync(r.Context(), h.tasksDir)
	if err != nil {
		if strings.Contains(err.Error(), "Git Synchronization issues") {
			common.SendError(w, http.StatusConflict, err.Error())
		} else {
			common.SendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	common.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":             "success",
		"synchronized_tasks": count,
	})
}

// GetInfo godoc
// @Summary      Get system info
// @Description  Get currently running version of Jotter and the data directory path.
// @Tags         system
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /system/info [get]
func (h *Handler) GetInfo(w http.ResponseWriter, r *http.Request) {
	common.SendJSON(w, http.StatusOK, map[string]string{
		"version":  h.version,
		"data_dir": h.tasksDir,
	})
}

// GetHistory godoc
// @Summary      Get git commit history
// @Description  Load recent git commit history for a project or the global workspace.
// @Tags         system
// @Produce      json
// @Param        projectId query string false "Project ID to load history for"
// @Success      200  {array}  map[string]string
// @Failure      500  {object}  common.ErrorResponse
// @Router       /system/history [get]
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectId")
	commits, err := h.svc.GetGitHistory(r.Context(), h.tasksDir, projectID)
	if err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	common.SendJSON(w, http.StatusOK, commits)
}

type RestoreRequest struct {
	CommitHash string `json:"commitHash"`
	ProjectID  string `json:"projectId"`
}

// Restore godoc
// @Summary      Restore workspace/project to a specific commit
// @Description  Revert the workspace or active project to the given commit, backing up any dirty changes first, and then rebuild the DB index.
// @Tags         system
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  common.ErrorResponse
// @Router       /system/restore [post]
func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	var req RestoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.SendError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CommitHash == "" {
		common.SendError(w, http.StatusBadRequest, "commitHash is required")
		return
	}

	count, err := h.svc.RestoreCommit(r.Context(), h.tasksDir, req.ProjectID, req.CommitHash)
	if err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	common.SendJSON(w, http.StatusOK, map[string]interface{}{
		"status":             "success",
		"synchronized_tasks": count,
	})
}
