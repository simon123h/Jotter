package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/models"
	"jotter/backend/internal/storage"
)

func RegisterTaskRoutes(r chi.Router, tasksDir string) {
	r.Get("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
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

		query := "SELECT id, project_id, title, bucket, position, tags, body, due_date, priority, color, created_at, updated_at FROM tasks WHERE project_id = ?"
		var args []interface{}
		args = append(args, projectID)

		bucket := r.URL.Query().Get("bucket")
		if bucket != "" {
			query += " AND bucket = ?"
			args = append(args, bucket)
		}

		excludeBucket := r.URL.Query().Get("exclude_bucket")
		if excludeBucket != "" {
			query += " AND bucket != ?"
			args = append(args, excludeBucket)
		}

		// Priority filtering
		priorities := r.URL.Query().Get("priorities")
		if priorities != "" {
			pList := strings.Split(priorities, ",")
			var activePriorities []string
			hasNone := false
			for _, p := range pList {
				p = strings.TrimSpace(p)
				if strings.ToLower(p) == "none" {
					hasNone = true
				} else if p != "" {
					activePriorities = append(activePriorities, strings.ToLower(p))
				}
			}

			if hasNone || len(activePriorities) > 0 {
				query += " AND ("
				subConditions := []string{}
				if hasNone {
					subConditions = append(subConditions, "priority IS NULL", "priority = ''")
				}
				if len(activePriorities) > 0 {
					var placeholders []string
					for _, p := range activePriorities {
						placeholders = append(placeholders, "?")
						args = append(args, p)
					}
					subConditions = append(subConditions, fmt.Sprintf("priority IN (%s)", strings.Join(placeholders, ",")))
				}
				query += strings.Join(subConditions, " OR ")
				query += ")"
			}
		}

		query += " ORDER BY position ASC"

		rows, err := db.DB.Query(query, args...)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var taskList []models.TaskResponse
		for rows.Next() {
			var t models.TaskResponse
			var tagsJSON string
			var dueDate, priority, color sql.NullString

			err := rows.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Bucket, &t.Position, &tagsJSON, &t.Body, &dueDate, &priority, &color, &t.CreatedAt, &t.UpdatedAt)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_ = json.Unmarshal([]byte(tagsJSON), &t.Tags)
			if dueDate.Valid {
				t.DueDate = &dueDate.String
			}
			if priority.Valid {
				t.Priority = &priority.String
			}
			if color.Valid {
				t.Color = &color.String
			}

			taskList = append(taskList, t)
		}

		if taskList == nil {
			taskList = []models.TaskResponse{}
		}

		SendJSON(w, http.StatusOK, taskList)
	})

	r.Post("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		if r.Body == nil {
			log.Printf("ERROR: POST /tasks - Request body is nil")
			SendError(w, http.StatusBadRequest, "Request body is missing")
			return
		}

		var req models.TaskCreate
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) == 0 {
			log.Printf("ERROR: POST /tasks - Request body is empty")
			SendError(w, http.StatusBadRequest, "Request body is empty")
			return
		}
		// Restore body for decoding
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("ERROR: POST /tasks - Failed to decode JSON: %v", err)
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

		// Verify bucket exists for this project
		err = db.DB.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, req.Bucket).Scan(&dummy)
		if err == sql.ErrNoRows {
			SendError(w, http.StatusBadRequest, fmt.Sprintf("Bucket '%s' does not exist in project '%s'.", req.Bucket, projectID))
			return
		} else if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)
		newID := storage.GenerateULID()

		// Calculate position: min position - 1000.0
		var minPos sql.NullFloat64
		_ = db.DB.QueryRow("SELECT MIN(position) FROM tasks WHERE project_id = ? AND bucket = ?", projectID, req.Bucket).Scan(&minPos)
		newPosition := 1000.0
		if minPos.Valid {
			newPosition = minPos.Float64 - 1000.0
		}

		var tags []string
		for _, t := range req.Tags {
			tags = append(tags, strings.ToLower(t))
		}

		taskMap := map[string]interface{}{
			"id":         newID,
			"project_id": projectID,
			"title":      req.Title,
			"bucket":     req.Bucket,
			"position":   newPosition,
			"tags":       tags,
			"body":       req.Body,
			"due_date":   req.DueDate,
			"priority":   req.Priority,
			"color":      req.Color,
			"created_at": nowStr,
			"updated_at": nowStr,
		}

		filename, errWrite := storage.WriteTaskFile(tasksDir, newID, taskMap)
		if errWrite != nil {
			SendError(w, http.StatusInternalServerError, "Failed to write task file")
			return
		}

		// Write to DB
		tagsJSON, _ := json.Marshal(tags)
		var dbDueDate, dbPriority, dbColor sql.NullString
		if req.DueDate != nil {
			dbDueDate = sql.NullString{String: *req.DueDate, Valid: true}
		}
		if req.Priority != nil {
			dbPriority = sql.NullString{String: *req.Priority, Valid: true}
		}
		if req.Color != nil {
			dbColor = sql.NullString{String: *req.Color, Valid: true}
		}

		_, err = db.DB.Exec("INSERT INTO tasks (id, project_id, title, bucket, position, tags, filename, body, due_date, priority, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			newID, projectID, req.Title, req.Bucket, newPosition, string(tagsJSON), filename, req.Body, dbDueDate, dbPriority, dbColor, nowStr, nowStr)
		if err != nil {
			// Clean up file if DB fails
			_ = storage.DeleteTaskFile(tasksDir, newID)
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		res := models.TaskResponse{
			ID:        newID,
			ProjectID: projectID,
			Title:     req.Title,
			Bucket:    req.Bucket,
			Position:  newPosition,
			Tags:      tags,
			Body:      req.Body,
			DueDate:   req.DueDate,
			Priority:  req.Priority,
			Color:     req.Color,
			CreatedAt: nowStr,
			UpdatedAt: nowStr,
		}
		SendJSON(w, http.StatusCreated, res)
	})

	r.Route("/projects/{project_id}/tasks/{task_id}", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			taskData, err := storage.ReadTaskFile(tasksDir, taskID)
			if err != nil || taskData.ProjectID != projectID {
				SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
				return
			}

			SendJSON(w, http.StatusOK, taskData)
		})

		r.Delete("/", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			existing, errRead := storage.ReadTaskFile(tasksDir, taskID)
			if errRead != nil || existing.ProjectID != projectID {
				SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
				return
			}

			deleted := storage.DeleteTaskFile(tasksDir, taskID)
			if !deleted {
				SendError(w, http.StatusInternalServerError, "Failed to delete task file")
				return
			}

			_, err := db.DB.Exec("DELETE FROM tasks WHERE id = ? AND project_id = ?", taskID, projectID)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			SendJSON(w, http.StatusOK, map[string]string{
				"status": "success",
				"detail": fmt.Sprintf("Task %s deleted", taskID),
			})
		})

		updateHandler := func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			bodyBytes, err := io.ReadAll(r.Body)
			if err != nil {
				SendError(w, http.StatusBadRequest, "Failed to read request body")
				return
			}

			var raw map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &raw); err != nil {
				SendError(w, http.StatusBadRequest, "Invalid JSON payload")
				return
			}

			var req models.TaskUpdate
			if err := json.Unmarshal(bodyBytes, &req); err != nil {
				SendError(w, http.StatusBadRequest, "Invalid request payload")
				return
			}

			existing, errRead := storage.ReadTaskFile(tasksDir, taskID)
			if errRead != nil || existing.ProjectID != projectID {
				SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
				return
			}

			nowStr := time.Now().UTC().Format(time.RFC3339Nano)
			nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

			updatedTitle := existing.Title
			if _, ok := raw["title"]; ok && req.Title != nil {
				updatedTitle = *req.Title
			}

			updatedBucket := existing.Bucket
			if _, ok := raw["bucket"]; ok && req.Bucket != nil {
				updatedBucket = *req.Bucket
			}

			updatedPosition := existing.Position
			if _, ok := raw["position"]; ok && req.Position != nil {
				updatedPosition = *req.Position
			}

			var updatedTags []string
			if _, ok := raw["tags"]; ok && req.Tags != nil {
				for _, tg := range *req.Tags {
					updatedTags = append(updatedTags, strings.ToLower(tg))
				}
			} else {
				updatedTags = existing.Tags
			}

			updatedBody := existing.Body
			if _, ok := raw["body"]; ok && req.Body != nil {
				updatedBody = *req.Body
			}

			updatedDueDate := existing.DueDate
			if _, ok := raw["due_date"]; ok {
				updatedDueDate = req.DueDate
			}

			updatedPriority := existing.Priority
			if _, ok := raw["priority"]; ok {
				updatedPriority = req.Priority
			}

			updatedColor := existing.Color
			if _, ok := raw["color"]; ok {
				updatedColor = req.Color
			}

			tx, err := db.DB.Begin()
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
			defer func() { _ = tx.Rollback() }()

			if _, ok := raw["bucket"]; ok && req.Bucket != nil && *req.Bucket != existing.Bucket {
				var bDummy string
				errB := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, updatedBucket).Scan(&bDummy)
				if errB == sql.ErrNoRows {
					if updatedBucket == "done" {
						var maxPos sql.NullFloat64
						_ = tx.QueryRow("SELECT MAX(position) FROM buckets WHERE project_id = ?", projectID).Scan(&maxPos)
						newPosition := 1000.0
						if maxPos.Valid {
							newPosition = maxPos.Float64 + 1000.0
						}
						_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, 'done', 'Done', '', ?, NULL, 'list', NULL, 0)",
							projectID, newPosition)
						if err != nil {
							SendError(w, http.StatusInternalServerError, err.Error())
							return
						}
					} else {
						SendError(w, http.StatusBadRequest, fmt.Sprintf("Bucket '%s' does not exist in project '%s'.", updatedBucket, projectID))
						return
					}
				} else if errB != nil {
					SendError(w, http.StatusInternalServerError, errB.Error())
					return
				}
			}

			taskMap := map[string]interface{}{
				"project_id": projectID,
				"title":      updatedTitle,
				"bucket":     updatedBucket,
				"position":   updatedPosition,
				"tags":       updatedTags,
				"body":       updatedBody,
				"due_date":   updatedDueDate,
				"priority":   updatedPriority,
				"color":      updatedColor,
				"created_at": existing.CreatedAt,
				"updated_at": nowStr,
			}

			filename, errWrite := storage.WriteTaskFile(tasksDir, taskID, taskMap)
			if errWrite != nil {
				SendError(w, http.StatusInternalServerError, "Failed to write task file")
				return
			}

			tagsJSON, _ := json.Marshal(updatedTags)
			var dbDueDate, dbPriority, dbColor sql.NullString
			if updatedDueDate != nil {
				dbDueDate = sql.NullString{String: *updatedDueDate, Valid: true}
			}
			if updatedPriority != nil {
				dbPriority = sql.NullString{String: *updatedPriority, Valid: true}
			}
			if updatedColor != nil {
				dbColor = sql.NullString{String: *updatedColor, Valid: true}
			}

			_, err = tx.Exec("UPDATE tasks SET title = ?, bucket = ?, position = ?, tags = ?, filename = ?, body = ?, due_date = ?, priority = ?, color = ?, updated_at = ? WHERE id = ? AND project_id = ?",
				updatedTitle, updatedBucket, updatedPosition, string(tagsJSON), filename, updatedBody, dbDueDate, dbPriority, dbColor, nowStr, taskID, projectID)
			if err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if err := tx.Commit(); err != nil {
				SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if _, ok := raw["bucket"]; ok && updatedBucket == "done" {
				_ = syncBucketsFile(tasksDir, projectID)
			}

			res := models.TaskResponse{
				ID:        taskID,
				ProjectID: projectID,
				Title:     updatedTitle,
				Bucket:    updatedBucket,
				Position:  updatedPosition,
				Tags:      updatedTags,
				Body:      updatedBody,
				DueDate:   updatedDueDate,
				Priority:  updatedPriority,
				Color:     updatedColor,
				CreatedAt: existing.CreatedAt,
				UpdatedAt: nowStr,
			}
			SendJSON(w, http.StatusOK, res)
		}

		r.Put("/", updateHandler)
		r.Patch("/", updateHandler)
	})

	r.Patch("/projects/{project_id}/tasks/{task_id}/move", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		taskID := chi.URLParam(r, "task_id")

		var req models.TaskMove
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		existing, errRead := storage.ReadTaskFile(tasksDir, taskID)
		if errRead != nil || existing.ProjectID != projectID {
			SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
			return
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

		tx, err := db.DB.Begin()
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		// Verify target bucket exists for this project
		var bDummy string
		errB := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, req.Bucket).Scan(&bDummy)
		if errB == sql.ErrNoRows {
			if req.Bucket == "done" {
				var maxPos sql.NullFloat64
				_ = tx.QueryRow("SELECT MAX(position) FROM buckets WHERE project_id = ?", projectID).Scan(&maxPos)
				newPosition := 1000.0
				if maxPos.Valid {
					newPosition = maxPos.Float64 + 1000.0
				}

				_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, 'done', 'Done', '', ?, NULL, 'list', NULL, 0)",
					projectID, newPosition)
				if err != nil {
					SendError(w, http.StatusInternalServerError, err.Error())
					return
				}
			} else {
				SendError(w, http.StatusBadRequest, fmt.Sprintf("Bucket '%s' does not exist in project '%s'.", req.Bucket, projectID))
				return
			}
		} else if errB != nil {
			SendError(w, http.StatusInternalServerError, errB.Error())
			return
		}

		taskMap := map[string]interface{}{
			"project_id": projectID,
			"title":      existing.Title,
			"bucket":     req.Bucket,
			"position":   req.Position,
			"tags":       existing.Tags,
			"body":       existing.Body,
			"due_date":   existing.DueDate,
			"priority":   existing.Priority,
			"color":      existing.Color,
			"created_at": existing.CreatedAt,
			"updated_at": nowStr,
		}

		filename, errWrite := storage.WriteTaskFile(tasksDir, taskID, taskMap)
		if errWrite != nil {
			SendError(w, http.StatusInternalServerError, "Failed to write task file")
			return
		}

		_, err = tx.Exec("UPDATE tasks SET bucket = ?, position = ?, filename = ?, updated_at = ? WHERE id = ? AND project_id = ?",
			req.Bucket, req.Position, filename, nowStr, taskID, projectID)
		if err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if req.Bucket == "done" {
			_ = syncBucketsFile(tasksDir, projectID)
		}

		res := models.TaskResponse{
			ID:        taskID,
			ProjectID: projectID,
			Title:     existing.Title,
			Bucket:    req.Bucket,
			Position:  req.Position,
			Tags:      existing.Tags,
			Body:      existing.Body,
			DueDate:   existing.DueDate,
			Priority:  existing.Priority,
			Color:     existing.Color,
			CreatedAt: existing.CreatedAt,
			UpdatedAt: nowStr,
		}
		SendJSON(w, http.StatusOK, res)
	})
}
