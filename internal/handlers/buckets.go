package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/models"
	"jotter/backend/internal/storage"
)

func RegisterBucketRoutes(r chi.Router, tasksDir string) {
	r.Get("/projects/{project_id}/buckets", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		// Verify project exists
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		rows, err := db.DB.Query("SELECT name, title, subtitle, position, color, layout, max_tasks, is_default FROM buckets WHERE project_id = ? ORDER BY position ASC", projectID)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var buckets []models.BucketResponse
		for rows.Next() {
			var b models.BucketResponse
			var color sql.NullString
			var maxTasks sql.NullInt64

			if err := rows.Scan(&b.Name, &b.Title, &b.Subtitle, &b.Position, &color, &b.Layout, &maxTasks, &b.IsDefault); err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if color.Valid {
				b.Color = &color.String
			}
			if maxTasks.Valid {
				v := int(maxTasks.Int64)
				b.MaxTasks = &v
			}
			buckets = append(buckets, b)
		}

		if buckets == nil {
			buckets = []models.BucketResponse{}
		}
		SendJSON(w, http.StatusOK, buckets)
	})

	r.Post("/projects/{project_id}/buckets", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		var req models.BucketCreate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		name := storage.Slugify(req.Title)
		if name == "" {
			SendError(w, http.StatusBadRequest, "Invalid title. Could not generate a bucket name slug.")
			return
		}

		// Verify project exists
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Check if bucket name already exists in this project
		var existingName string
		err = db.DB.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, name).Scan(&existingName)
		if err != sql.ErrNoRows {
			if err == nil {
				SendError(w, http.StatusBadRequest, fmt.Sprintf("A column with a similar name '%s' already exists in project '%s'.", name, projectID))
				return
			}
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Calculate position: max position + 1000.0
		var maxPos sql.NullFloat64
		_ = db.DB.QueryRow("SELECT MAX(position) FROM buckets WHERE project_id = ?", projectID).Scan(&maxPos)
		newPosition := 1000.0
		if maxPos.Valid {
			newPosition = maxPos.Float64 + 1000.0
		}

		isDefault := false
		if req.IsDefault != nil {
			isDefault = *req.IsDefault
		}

		tx, err := db.DB.Begin()
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		if isDefault {
			_, err = tx.Exec("UPDATE buckets SET is_default = 0 WHERE project_id = ?", projectID)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}

		var subtitle string
		if req.Subtitle != nil {
			subtitle = *req.Subtitle
		}

		var color sql.NullString
		if req.Color != nil {
			color = sql.NullString{String: *req.Color, Valid: true}
		}

		layout := "list"
		if req.Layout != nil {
			layout = *req.Layout
		}

		var maxTasks sql.NullInt64
		if req.MaxTasks != nil {
			maxTasks = sql.NullInt64{Int64: int64(*req.MaxTasks), Valid: true}
		}

		_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			projectID, name, req.Title, subtitle, newPosition, color, layout, maxTasks, isDefault)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Sync buckets.json file
		if err := syncBucketsFile(tasksDir, projectID); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to sync buckets.json file")
			return
		}

		res := models.BucketResponse{
			Name:      name,
			Title:     req.Title,
			Subtitle:  subtitle,
			Position:  newPosition,
			Color:     req.Color,
			Layout:    layout,
			MaxTasks:  req.MaxTasks,
			IsDefault: isDefault,
		}
		SendJSON(w, http.StatusCreated, res)
	})

	r.Put("/projects/{project_id}/buckets/{name}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		name := chi.URLParam(r, "name")

		var req models.BucketUpdate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		// Verify project exists
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Check if bucket exists
		var b models.BucketResponse
		var color sql.NullString
		var maxTasks sql.NullInt64
		err = db.DB.QueryRow("SELECT name, title, subtitle, position, color, layout, max_tasks, is_default FROM buckets WHERE project_id = ? AND name = ?", projectID, name).Scan(
			&b.Name, &b.Title, &b.Subtitle, &b.Position, &color, &b.Layout, &maxTasks, &b.IsDefault)

		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Column '%s' not found in project '%s'.", name, projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if color.Valid {
			b.Color = &color.String
		}
		if maxTasks.Valid {
			v := int(maxTasks.Int64)
			b.MaxTasks = &v
		}

		// Update properties in memory
		if req.Title != nil {
			b.Title = *req.Title
		}
		if req.Subtitle != nil {
			b.Subtitle = *req.Subtitle
		}
		if req.Position != nil {
			b.Position = *req.Position
		}
		if req.Color != nil {
			b.Color = req.Color
		}
		if req.Layout != nil {
			b.Layout = *req.Layout
		}
		if req.MaxTasks != nil {
			b.MaxTasks = req.MaxTasks
		}

		isDefaultChanged := req.IsDefault != nil && *req.IsDefault != b.IsDefault
		if req.IsDefault != nil {
			b.IsDefault = *req.IsDefault
		}

		tx, err := db.DB.Begin()
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		if isDefaultChanged && b.IsDefault {
			_, err = tx.Exec("UPDATE buckets SET is_default = 0 WHERE project_id = ?", projectID)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}

		var updateColor sql.NullString
		if b.Color != nil {
			updateColor = sql.NullString{String: *b.Color, Valid: true}
		}

		var updateMaxTasks sql.NullInt64
		if b.MaxTasks != nil {
			updateMaxTasks = sql.NullInt64{Int64: int64(*b.MaxTasks), Valid: true}
		}

		_, err = tx.Exec("UPDATE buckets SET title = ?, subtitle = ?, position = ?, color = ?, layout = ?, max_tasks = ?, is_default = ? WHERE project_id = ? AND name = ?",
			b.Title, b.Subtitle, b.Position, updateColor, b.Layout, updateMaxTasks, b.IsDefault, projectID, name)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Sync buckets.json file
		if err := syncBucketsFile(tasksDir, projectID); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to sync buckets.json file")
			return
		}

		SendJSON(w, http.StatusOK, b)
	})

	r.Delete("/projects/{project_id}/buckets/{name}", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		name := chi.URLParam(r, "name")

		// Verify project exists
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Check if bucket exists
		err = db.DB.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, name).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Column '%s' not found in project '%s'.", name, projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Check if there are tasks in this bucket in this project
		var taskCount int
		err = db.DB.QueryRow("SELECT COUNT(*) FROM tasks WHERE project_id = ? AND bucket = ?", projectID, name).Scan(&taskCount)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if taskCount > 0 {
			SendError(w, http.StatusBadRequest, fmt.Sprintf("Cannot delete column '%s' because it contains %d task(s). Please move or delete these tasks first.", name, taskCount))
			return
		}

		_, err = db.DB.Exec("DELETE FROM buckets WHERE project_id = ? AND name = ?", projectID, name)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Sync buckets.json file
		if err := syncBucketsFile(tasksDir, projectID); err != nil {
			SendError(w, http.StatusInternalServerError, "Failed to sync buckets.json file")
			return
		}

		SendJSON(w, http.StatusOK, map[string]string{
			"status": "success",
			"detail": fmt.Sprintf("Column '%s' deleted", name),
		})
	})
}

func syncBucketsFile(tasksDir string, projectID string) error {
	rows, err := db.DB.Query("SELECT name, title, subtitle, position, color, layout, max_tasks, is_default FROM buckets WHERE project_id = ? ORDER BY position ASC", projectID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var buckets []map[string]interface{}
	for rows.Next() {
		var name, title, subtitle, layout string
		var position float64
		var color sql.NullString
		var maxTasks sql.NullInt64
		var isDefault bool

		if err := rows.Scan(&name, &title, &subtitle, &position, &color, &layout, &maxTasks, &isDefault); err != nil {
			return err
		}

		bMap := map[string]interface{}{
			"name":       name,
			"title":      title,
			"subtitle":   subtitle,
			"position":   position,
			"layout":     layout,
			"is_default": isDefault,
		}
		if color.Valid {
			bMap["color"] = color.String
		} else {
			bMap["color"] = nil
		}
		if maxTasks.Valid {
			bMap["max_tasks"] = int(maxTasks.Int64)
		} else {
			bMap["max_tasks"] = nil
		}

		buckets = append(buckets, bMap)
	}

	return storage.WriteBucketsFile(tasksDir, projectID, buckets)
}
