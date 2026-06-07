package system

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
	"jotter/backend/internal/features/settings"
)

// RegisterRoutes registers settings sub-routes.
// It internally bootstraps the layered architecture for settings,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	dbRepo := NewSQLRepository(db.DB)
	fileRepo := NewFileRepository()
	settingsRepo := settings.NewFileRepository()
	svc := NewService(dbRepo, fileRepo, settingsRepo)

	r.Post("/system/sync", func(w http.ResponseWriter, r *http.Request) {
		count, err := svc.Sync(r.Context(), tasksDir)
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
	})
}
