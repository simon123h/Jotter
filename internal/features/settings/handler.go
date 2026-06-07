package settings

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"jotter/backend/internal/features/common"
)

// RegisterRoutes registers settings sub-routes.
// It internally bootstraps the layered architecture for settings,
// maintaining backwards compatibility with caller signatures.
func RegisterRoutes(r chi.Router, tasksDir string) {
	fileRepo := NewFileRepository()
	svc := NewService(fileRepo)

	r.Get("/settings", func(w http.ResponseWriter, r *http.Request) {
		appSettings, err := svc.GetSettings(r.Context(), tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		common.SendJSON(w, http.StatusOK, appSettings)
	})

	r.Post("/settings", func(w http.ResponseWriter, r *http.Request) {
		var appSettings AppSettings
		if err := json.NewDecoder(r.Body).Decode(&appSettings); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		if err := svc.SaveSettings(r.Context(), tasksDir, appSettings); err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		common.SendJSON(w, http.StatusOK, map[string]string{"status": "success"})
	})
}
