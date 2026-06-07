package settings

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"jotter/backend/internal/features/common"
)

func RegisterRoutes(r chi.Router, tasksDir string) {
	r.Get("/settings", func(w http.ResponseWriter, r *http.Request) {
		settings, err := LoadSettings(tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		common.SendJSON(w, http.StatusOK, settings)
	})

	r.Post("/settings", func(w http.ResponseWriter, r *http.Request) {
		var settings AppSettings
		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		if err := SaveSettings(tasksDir, settings); err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		common.SendJSON(w, http.StatusOK, map[string]string{"status": "success"})
	})
}
