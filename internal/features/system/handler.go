package system

import (
	"database/sql"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
)

func RegisterRoutes(r chi.Router, tasksDir string) {
	r.Post("/system/sync", func(w http.ResponseWriter, r *http.Request) {
		// 1. Fetch all projects from DB
		rows, err := db.DB.Query("SELECT id, git_remote FROM projects")
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var gitErrors []string
		for rows.Next() {
			var id string
			var remote sql.NullString
			if err := rows.Scan(&id, &remote); err != nil {
				continue
			}

			projectPath := filepath.Join(tasksDir, id)
			remoteURL := ""
			if remote.Valid {
				remoteURL = remote.String
			}

			// Perform Git Sync for this specific project
			if errSync := common.GitSync(projectPath, remoteURL); errSync != nil {
				gitErrors = append(gitErrors, fmt.Sprintf("Project '%s': %v", id, errSync))
			}
		}

		if len(gitErrors) > 0 {
			common.SendError(w, http.StatusConflict, fmt.Sprintf("Git Synchronization issues:\n%s", strings.Join(gitErrors, "\n")))
			return
		}

		// 2. Database Index Sync
		count, err := SyncDBWithFiles(tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, fmt.Sprintf("Database Synchronization failed: %v", err))
			return
		}

		common.SendJSON(w, http.StatusOK, map[string]interface{}{
			"status":             "success",
			"synchronized_tasks": count,
		})
	})
}
