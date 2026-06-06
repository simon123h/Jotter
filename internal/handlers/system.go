package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/storage"
)

func RegisterSystemRoutes(r chi.Router, tasksDir string) {
	r.Post("/system/sync", func(w http.ResponseWriter, r *http.Request) {
		// 1. Git Sync (if it's a git repo)
		if err := storage.GitSync(tasksDir); err != nil {
			SendError(w, http.StatusConflict, fmt.Sprintf("Git Synchronization failed: %v", err))
			return
		}

		// 2. Database Index Sync
		count, err := storage.SyncDBWithFiles(tasksDir)
		if err != nil {
			SendError(w, http.StatusInternalServerError, fmt.Sprintf("Database Synchronization failed: %v", err))
			return
		}

		SendJSON(w, http.StatusOK, map[string]interface{}{
			"status":             "success",
			"synchronized_tasks": count,
		})
	})
}
