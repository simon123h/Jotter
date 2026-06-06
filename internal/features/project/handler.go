package project

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/common"
)

func RegisterRoutes(r chi.Router, tasksDir string, defaultBuckets []map[string]interface{}, syncBucketsFunc func(string, string) error) {
	r.Get("/projects", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.DB.Query("SELECT id, title, created_at, done_clean_period, git_remote FROM projects ORDER BY created_at ASC")
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var projects []Response
		for rows.Next() {
			var p Response
			var cleanPeriod sql.NullInt64
			var remote sql.NullString
			if err := rows.Scan(&p.ID, &p.Title, &p.CreatedAt, &cleanPeriod, &remote); err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if cleanPeriod.Valid {
				v := int(cleanPeriod.Int64)
				p.DoneCleanPeriod = &v
			}
			if remote.Valid {
				p.GitRemote = &remote.String
			}
			projects = append(projects, p)
		}

		if projects == nil {
			projects = []Response{}
		}
		common.SendJSON(w, http.StatusOK, projects)
	})

	r.Post("/projects", func(w http.ResponseWriter, r *http.Request) {
		var req Create
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		projectID := common.Slugify(req.Title)
		if projectID == "" {
			common.SendError(w, http.StatusBadRequest, "Invalid title. Could not generate a project ID slug.")
			return
		}

		projects, err := LoadProjectsFile(tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to load projects file")
			return
		}

		for _, p := range projects {
			if p["id"] == projectID {
				common.SendError(w, http.StatusBadRequest, fmt.Sprintf("Project with ID '%s' already exists.", projectID))
				return
			}
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

		var gitRemoteVal interface{}
		if req.GitRemote != nil {
			gitRemoteVal = *req.GitRemote
		} else {
			gitRemoteVal = nil
		}

		newProject := map[string]interface{}{
			"id":                projectID,
			"title":             req.Title,
			"created_at":        nowStr,
			"done_clean_period": req.DoneCleanPeriod,
			"git_remote":        gitRemoteVal,
		}

		projects = append(projects, newProject)
		if err := WriteProjectsFile(tasksDir, projects); err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to write projects registry")
			return
		}

		// Initialize buckets.json with defaults
		// We'll pass the WriteBucketsFile logic or just use a local helper if we move it to bucket feature
		// For now, let's assume we have a way to write buckets

		// Insert to database in transaction
		tx, err := db.DB.Begin()
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		var doneCleanPeriod sql.NullInt64
		if req.DoneCleanPeriod != nil {
			doneCleanPeriod = sql.NullInt64{Int64: int64(*req.DoneCleanPeriod), Valid: true}
		}

		var gitRemote sql.NullString
		if req.GitRemote != nil {
			gitRemote = sql.NullString{String: *req.GitRemote, Valid: true}
		}

		_, err = tx.Exec("INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
			projectID, req.Title, nowStr, doneCleanPeriod, gitRemote)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		for _, b := range defaultBuckets {
			bName := b["name"].(string)
			bTitle := b["title"].(string)
			bPos := b["position"].(float64)
			bDefault := b["is_default"].(bool)

			_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				projectID, bName, bTitle, "", bPos, nil, "list", nil, bDefault)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}

		if err := tx.Commit(); err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Initial sync
		_ = syncBucketsFunc(tasksDir, projectID)

		res := Response{
			ID:              projectID,
			Title:           req.Title,
			CreatedAt:       nowStr,
			DoneCleanPeriod: req.DoneCleanPeriod,
			GitRemote:       req.GitRemote,
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

		projects, err := LoadProjectsFile(tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to load projects file")
			return
		}

		var projectFound map[string]interface{}
		for _, p := range projects {
			if p["id"] == projectID {
				projectFound = p
				break
			}
		}

		if projectFound == nil {
			common.SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		}

		if _, ok := raw["title"]; ok && req.Title != nil {
			projectFound["title"] = *req.Title
		}
		if _, ok := raw["done_clean_period"]; ok {
			projectFound["done_clean_period"] = req.DoneCleanPeriod
		}
		if _, ok := raw["git_remote"]; ok {
			if req.GitRemote != nil {
				projectFound["git_remote"] = *req.GitRemote
			} else {
				projectFound["git_remote"] = nil
			}
		}

		if err := WriteProjectsFile(tasksDir, projects); err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to write projects registry")
			return
		}

		// Update database
		var doneCleanPeriod sql.NullInt64
		if projectFound["done_clean_period"] != nil {
			// Handle type conversion from map
			switch v := projectFound["done_clean_period"].(type) {
			case float64:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int64:
				doneCleanPeriod = sql.NullInt64{Int64: v, Valid: true}
			}
		}

		var gitRemote sql.NullString
		if projectFound["git_remote"] != nil {
			if r, ok := projectFound["git_remote"].(string); ok {
				gitRemote = sql.NullString{String: r, Valid: true}
			}
		}

		title, _ := projectFound["title"].(string)
		_, err = db.DB.Exec("UPDATE projects SET title = ?, done_clean_period = ?, git_remote = ? WHERE id = ?", title, doneCleanPeriod, gitRemote, projectID)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		created, _ := projectFound["created_at"].(string)
		var resCleanPeriod *int
		if doneCleanPeriod.Valid {
			v := int(doneCleanPeriod.Int64)
			resCleanPeriod = &v
		}
		var resGitRemote *string
		if gitRemote.Valid {
			resGitRemote = &gitRemote.String
		}

		res := Response{
			ID:              projectID,
			Title:           title,
			CreatedAt:       created,
			DoneCleanPeriod: resCleanPeriod,
			GitRemote:       resGitRemote,
		}
		common.SendJSON(w, http.StatusOK, res)
	})

	r.Delete("/projects/{project_id}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		projects, err := LoadProjectsFile(tasksDir)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to load projects file")
			return
		}

		if len(projects) <= 1 {
			common.SendError(w, http.StatusBadRequest, "Cannot delete the last remaining project.")
			return
		}

		var filtered []map[string]interface{}
		found := false
		for _, p := range projects {
			if p["id"] == projectID {
				found = true
			} else {
				filtered = append(filtered, p)
			}
		}

		if !found {
			common.SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		}

		if err := WriteProjectsFile(tasksDir, filtered); err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to update projects registry")
			return
		}

		if err := DeleteProjectDir(tasksDir, projectID); err != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to delete project files")
			return
		}

		// Delete from SQLite (foreign keys ON will cascade delete tasks and buckets!)
		_, err = db.DB.Exec("DELETE FROM projects WHERE id = ?", projectID)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		common.SendJSON(w, http.StatusOK, map[string]string{
			"status": "success",
			"detail": fmt.Sprintf("Project '%s' deleted", projectID),
		})
	})
}
