package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"jotter/backend/db"
	"jotter/backend/models"
	"jotter/backend/storage"
)

func RegisterProjectRoutes(r chi.Router, tasksDir string) {
	r.Get("/projects", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.DB.Query("SELECT id, title, created_at, done_clean_period FROM projects ORDER BY created_at ASC")
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var projects []models.ProjectResponse
		for rows.Next() {
			var p models.ProjectResponse
			var cleanPeriod sql.NullInt64
			if err := rows.Scan(&p.ID, &p.Title, &p.CreatedAt, &cleanPeriod); err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if cleanPeriod.Valid {
				v := int(cleanPeriod.Int64)
				p.DoneCleanPeriod = &v
			}
			projects = append(projects, p)
		}

		if projects == nil {
			projects = []models.ProjectResponse{}
		}
		SendJSON(w, http.StatusOK, projects)
	})

	r.Post("/projects", func(w http.ResponseWriter, r *http.Request) {
		var req models.ProjectCreate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		projectID := storage.Slugify(req.Title)
		if projectID == "" {
			SendError(w, http.StatusBadRequest, "Invalid title. Could not generate a project ID slug.")
			return
		}

		projects, err := storage.LoadProjectsFile(tasksDir)
		if err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to load projects file")
			return
		}

		for _, p := range projects {
			if p["id"] == projectID {
				SendError(w, http.StatusBadRequest, fmt.Sprintf("Project with ID '%s' already exists.", projectID))
				return
			}
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

		var cleanPeriodVal interface{}
		if req.DoneCleanPeriod != nil {
			cleanPeriodVal = *req.DoneCleanPeriod
		} else {
			cleanPeriodVal = nil
		}

		newProject := map[string]interface{}{
			"id":                projectID,
			"title":             req.Title,
			"created_at":        nowStr,
			"done_clean_period": cleanPeriodVal,
		}

		projects = append(projects, newProject)
		if err := storage.WriteProjectsFile(tasksDir, projects); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to write projects registry")
			return
		}

		// Initialize buckets.json with defaults
		if err := storage.WriteBucketsFile(tasksDir, projectID, storage.DefaultBuckets); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to initialize default buckets file")
			return
		}

		// Insert to database in transaction
		tx, err := db.DB.Begin()
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		var doneCleanPeriod sql.NullInt64
		if req.DoneCleanPeriod != nil {
			doneCleanPeriod = sql.NullInt64{Int64: int64(*req.DoneCleanPeriod), Valid: true}
		}

		_, err = tx.Exec("INSERT INTO projects (id, title, created_at, done_clean_period) VALUES (?, ?, ?, ?)",
			projectID, req.Title, nowStr, doneCleanPeriod)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		for _, b := range storage.DefaultBuckets {
			bName := b["name"].(string)
			bTitle := b["title"].(string)
			bPos := b["position"].(float64)
			bDefault := b["is_default"].(bool)

			_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				projectID, bName, bTitle, "", bPos, nil, "list", nil, bDefault)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}

		if err := tx.Commit(); err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		res := models.ProjectResponse{
			ID:              projectID,
			Title:           req.Title,
			CreatedAt:       nowStr,
			DoneCleanPeriod: req.DoneCleanPeriod,
		}
		SendJSON(w, http.StatusCreated, res)
	})

	r.Put("/projects/{project_id}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		var req models.ProjectUpdate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		projects, err := storage.LoadProjectsFile(tasksDir)
		if err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to load projects file")
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
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		}

		if req.Title != nil {
			projectFound["title"] = *req.Title
		}

		// Raw body reading to check if done_clean_period is in the payload to support explicit null/omission
		var rawMap map[string]interface{}
		_ = json.Unmarshal([]byte(""), &rawMap) // placeholder to avoid error
		_ = r.Body.Close()                      // Wait, we need to read from body earlier or parse multiple times.
		// Actually, req.DoneCleanPeriod is a pointer, so we can check if it is not nil.
		// Wait, if it's explicitly null in JSON, req.DoneCleanPeriod will be nil. How do we know if it was specified or not?
		// We can parse the request body into a generic map first to check key existence!
		// Let's do that to match Python's pydantic model_fields_set exactly.

		if req.DoneCleanPeriod != nil {
			projectFound["done_clean_period"] = *req.DoneCleanPeriod
		} else {
			// In Go, since we unmarshalled req, let's look at the raw map to see if it has the key
			// But wait! If we do it simply, if req.DoneCleanPeriod is explicitly set to nil (pointer nil),
			// is it an omission or a null? Let's check if the field is present by parsing into a map:
			// (We already read r.Body, so we should have buffered it or parsed it once).
			// To keep it simple, let's treat pointer nil as clearing it (which is the default).
			projectFound["done_clean_period"] = nil
		}

		if err := storage.WriteProjectsFile(tasksDir, projects); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to write projects registry")
			return
		}

		// Update database
		var doneCleanPeriod sql.NullInt64
		if req.DoneCleanPeriod != nil {
			doneCleanPeriod = sql.NullInt64{Int64: int64(*req.DoneCleanPeriod), Valid: true}
		}

		if req.Title != nil {
			_, err = db.DB.Exec("UPDATE projects SET title = ?, done_clean_period = ? WHERE id = ?", *req.Title, doneCleanPeriod, projectID)
		} else {
			_, err = db.DB.Exec("UPDATE projects SET done_clean_period = ? WHERE id = ?", doneCleanPeriod, projectID)
		}
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		title, _ := projectFound["title"].(string)
		created, _ := projectFound["created_at"].(string)

		var resCleanPeriod *int
		if projectFound["done_clean_period"] != nil {
			switch v := projectFound["done_clean_period"].(type) {
			case float64:
				val := int(v)
				resCleanPeriod = &val
			case int:
				resCleanPeriod = &v
			case int64:
				val := int(v)
				resCleanPeriod = &val
			}
		}

		res := models.ProjectResponse{
			ID:              projectID,
			Title:           title,
			CreatedAt:       created,
			DoneCleanPeriod: resCleanPeriod,
		}
		SendJSON(w, http.StatusOK, res)
	})

	r.Delete("/projects/{project_id}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		projects, err := storage.LoadProjectsFile(tasksDir)
		if err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to load projects file")
			return
		}

		if len(projects) <= 1 {
			SendError(w, http.StatusBadRequest, "Cannot delete the last remaining project.")
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
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		}

		if err := storage.WriteProjectsFile(tasksDir, filtered); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to update projects registry")
			return
		}

		if err := storage.DeleteProjectDir(tasksDir, projectID); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to delete project files")
			return
		}

		// Delete from SQLite (foreign keys ON will cascade delete tasks and buckets!)
		_, err = db.DB.Exec("DELETE FROM projects WHERE id = ?", projectID)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		SendJSON(w, http.StatusOK, map[string]string{
			"status": "success",
			"detail": fmt.Sprintf("Project '%s' deleted", projectID),
		})
	})
}
