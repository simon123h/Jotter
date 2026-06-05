package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"jotter/backend/storage"
)

func RegisterSystemRoutes(r chi.Router, tasksDir string) {
	r.Post("/system/sync", func(w http.ResponseWriter, r *http.Request) {
		count, err := storage.SyncDBWithFiles(tasksDir)
		if err != nil {
			SendError(w, http.StatusInternalServerError, fmt.Sprintf("Synchronization failed: %v", err))
			return
		}

		SendJSON(w, http.StatusOK, map[string]interface{}{
			"status":             "success",
			"synchronized_tasks": count,
		})
	})
}
