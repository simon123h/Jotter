package system

import (
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
}

func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	settingsRepo := settings.NewFileRepository()
	svc := NewService(dbRepo, fileRepo, settingsRepo)
	h := &Handler{svc: svc, tasksDir: tasksDir}

	r.Post("/system/sync", h.Sync)
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
