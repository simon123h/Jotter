package task

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/bucket"
	"jotter/backend/internal/features/common"
)

func RegisterRoutes(r chi.Router, tasksDir string) {
	r.Get("/tasks", func(w http.ResponseWriter, r *http.Request) {
		query := "SELECT id, project_id, title, bucket, position, tags, attachments, body, due_date, planned_date, priority, color, created_at, updated_at FROM tasks WHERE 1=1"
		var args []interface{}

		excludeBuckets := r.URL.Query().Get("exclude_buckets")
		if excludeBuckets != "" {
			bucketList := strings.Split(excludeBuckets, ",")
			if len(bucketList) > 0 {
				var placeholders []string
				for _, b := range bucketList {
					placeholders = append(placeholders, "?")
					args = append(args, strings.TrimSpace(b))
				}
				query += fmt.Sprintf(" AND bucket NOT IN (%s)", strings.Join(placeholders, ","))
			}
		}

		query += " ORDER BY created_at DESC"

		rows, err := db.DB.Query(query, args...)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var taskList []Response
		for rows.Next() {
			var t Response
			var tagsJSON, attachmentsJSON string
			var dueDate, plannedDate, priority, color sql.NullString

			err := rows.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Bucket, &t.Position, &tagsJSON, &attachmentsJSON, &t.Body, &dueDate, &plannedDate, &priority, &color, &t.CreatedAt, &t.UpdatedAt)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_ = json.Unmarshal([]byte(tagsJSON), &t.Tags)
			_ = json.Unmarshal([]byte(attachmentsJSON), &t.Attachments)
			if dueDate.Valid {
				t.DueDate = &dueDate.String
			}
			if plannedDate.Valid {
				t.PlannedDate = &plannedDate.String
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
			taskList = []Response{}
		}

		common.SendJSON(w, http.StatusOK, taskList)
	})

	r.Get("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		// Verify project exists
		var dummy string
		err := db.DB.QueryRow("SELECT id FROM projects WHERE id = ?", projectID).Scan(&dummy)
		if err == sql.ErrNoRows {
			common.SendError(w, http.StatusNotFound, fmt.Sprintf("Project '%s' not found.", projectID))
			return
		} else if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		query := "SELECT id, project_id, title, bucket, position, tags, attachments, body, due_date, planned_date, priority, color, created_at, updated_at FROM tasks WHERE project_id = ?"
		var args []interface{}
		args = append(args, projectID)

		bucketName := r.URL.Query().Get("bucket")
		if bucketName != "" {
			query += " AND bucket = ?"
			args = append(args, bucketName)
		}

		excludeBucket := r.URL.Query().Get("exclude_bucket")
		if excludeBucket != "" {
			query += " AND bucket != ?"
			args = append(args, excludeBucket)
		}

		excludeBuckets := r.URL.Query().Get("exclude_buckets")
		if excludeBuckets != "" {
			bucketList := strings.Split(excludeBuckets, ",")
			if len(bucketList) > 0 {
				var placeholders []string
				for _, b := range bucketList {
					placeholders = append(placeholders, "?")
					args = append(args, strings.TrimSpace(b))
				}
				query += fmt.Sprintf(" AND bucket NOT IN (%s)", strings.Join(placeholders, ","))
			}
		}

		// Priority filtering
		priorities := r.URL.Query().Get("priorities")
		if priorities != "" {
			pList := strings.Split(priorities, ",")
			var activePriorities []string
			var includeNone bool
			for _, p := range pList {
				p = strings.TrimSpace(p)
				if p == "none" || p == "" {
					includeNone = true
				} else {
					activePriorities = append(activePriorities, p)
				}
			}

			if len(activePriorities) > 0 || includeNone {
				query += " AND ("
				var subConditions []string
				if includeNone {
					subConditions = append(subConditions, "(priority IS NULL OR priority = '')")
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
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var taskList []Response
		for rows.Next() {
			var t Response
			var tagsJSON, attachmentsJSON string
			var dueDate, plannedDate, priority, color sql.NullString

			err := rows.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Bucket, &t.Position, &tagsJSON, &attachmentsJSON, &t.Body, &dueDate, &plannedDate, &priority, &color, &t.CreatedAt, &t.UpdatedAt)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			_ = json.Unmarshal([]byte(tagsJSON), &t.Tags)
			_ = json.Unmarshal([]byte(attachmentsJSON), &t.Attachments)
			if dueDate.Valid {
				t.DueDate = &dueDate.String
			}
			if plannedDate.Valid {
				t.PlannedDate = &plannedDate.String
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
			taskList = []Response{}
		}

		common.SendJSON(w, http.StatusOK, taskList)
	})

	r.Post("/projects/{project_id}/tasks", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")

		if r.Body == nil {
			common.SendError(w, http.StatusBadRequest, "Request body is missing")
			return
		}

		var req Create
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		newID := common.GenerateULID()
		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

		// Get max position for initial positioning
		var maxPos sql.NullFloat64
		_ = db.DB.QueryRow("SELECT MAX(position) FROM tasks WHERE project_id = ? AND bucket = ?", projectID, req.Bucket).Scan(&maxPos)
		newPosition := 1000.0
		if maxPos.Valid {
			newPosition = maxPos.Float64 + 1000.0
		}

		var tags []string
		for _, t := range req.Tags {
			tags = append(tags, strings.ToLower(t))
		}

		taskMap := map[string]interface{}{
			"id":           newID,
			"project_id":   projectID,
			"title":        req.Title,
			"bucket":       req.Bucket,
			"position":     newPosition,
			"tags":         tags,
			"attachments":  []string{},
			"body":         req.Body,
			"due_date":     req.DueDate,
			"planned_date": req.PlannedDate,
			"priority":     req.Priority,
			"color":        req.Color,
			"created_at":   nowStr,
			"updated_at":   nowStr,
		}

		filename, errWrite := WriteTaskFile(tasksDir, newID, taskMap)
		if errWrite != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to write task file")
			return
		}

		// Write to DB
		tagsJSON, _ := json.Marshal(tags)
		attachmentsJSON, _ := json.Marshal([]string{})
		var dbDueDate, dbPlannedDate, dbPriority, dbColor sql.NullString
		if req.DueDate != nil {
			dbDueDate = sql.NullString{String: *req.DueDate, Valid: true}
		}
		if req.PlannedDate != nil {
			dbPlannedDate = sql.NullString{String: *req.PlannedDate, Valid: true}
		}
		if req.Priority != nil {
			dbPriority = sql.NullString{String: *req.Priority, Valid: true}
		}
		if req.Color != nil {
			dbColor = sql.NullString{String: *req.Color, Valid: true}
		}

		_, err := db.DB.Exec("INSERT INTO tasks (id, project_id, title, bucket, position, tags, attachments, filename, body, due_date, planned_date, priority, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			newID, projectID, req.Title, req.Bucket, newPosition, string(tagsJSON), string(attachmentsJSON), filename, req.Body, dbDueDate, dbPlannedDate, dbPriority, dbColor, nowStr, nowStr)
		if err != nil {
			// Clean up file if DB fails
			_ = DeleteTaskFile(tasksDir, newID)
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		res := Response{
			ID:          newID,
			ProjectID:   projectID,
			Title:       req.Title,
			Bucket:      req.Bucket,
			Position:    newPosition,
			Tags:        tags,
			Attachments: []string{},
			Body:        req.Body,
			DueDate:     req.DueDate,
			PlannedDate: req.PlannedDate,
			Priority:    req.Priority,
			Color:       req.Color,
			CreatedAt:   nowStr,
			UpdatedAt:   nowStr,
		}
		common.SendJSON(w, http.StatusCreated, res)
	})

	r.Route("/projects/{project_id}/tasks/{task_id}", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			taskID := chi.URLParam(r, "task_id")
			res, err := ReadTaskFile(tasksDir, taskID)
			if err != nil {
				common.SendError(w, http.StatusNotFound, err.Error())
				return
			}
			common.SendJSON(w, http.StatusOK, res)
		})

		r.Delete("/", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			existing, errRead := ReadTaskFile(tasksDir, taskID)
			if errRead != nil || existing.ProjectID != projectID {
				common.SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
				return
			}

			deleted := DeleteTaskFile(tasksDir, taskID)
			if !deleted {
				common.SendError(w, http.StatusInternalServerError, "Failed to delete task file")
				return
			}

			_, err := db.DB.Exec("DELETE FROM tasks WHERE id = ? AND project_id = ?", taskID, projectID)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			common.SendJSON(w, http.StatusOK, map[string]string{
				"status": "success",
				"detail": fmt.Sprintf("Task %s deleted", taskID),
			})
		})

		updateHandler := func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

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

			existing, errRead := ReadTaskFile(tasksDir, taskID)
			if errRead != nil || existing.ProjectID != projectID {
				common.SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
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

			updatedPlannedDate := existing.PlannedDate
			if _, ok := raw["planned_date"]; ok {
				updatedPlannedDate = req.PlannedDate
			}

			updatedPriority := existing.Priority
			if _, ok := raw["priority"]; ok {
				updatedPriority = req.Priority
			}

			updatedColor := existing.Color
			if _, ok := raw["color"]; ok {
				updatedColor = req.Color
			}

			updatedAttachments := existing.Attachments
			if _, ok := raw["attachments"]; ok && req.Attachments != nil {
				updatedAttachments = *req.Attachments
			}

			updatedProjectID := existing.ProjectID
			if _, ok := raw["project_id"]; ok && req.ProjectID != nil {
				updatedProjectID = *req.ProjectID
			}

			tx, err := db.DB.Begin()
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}
			defer func() { _ = tx.Rollback() }()

			// Handle Project Move
			if updatedProjectID != existing.ProjectID {
				// Verify target project exists
				var pDummy string
				errP := tx.QueryRow("SELECT id FROM projects WHERE id = ?", updatedProjectID).Scan(&pDummy)
				if errP == sql.ErrNoRows {
					common.SendError(w, http.StatusBadRequest, fmt.Sprintf("Target project '%s' not found.", updatedProjectID))
					return
				}

				var bDummy string
				errB := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", updatedProjectID, updatedBucket).Scan(&bDummy)
				if errB == sql.ErrNoRows {
					errB2 := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? ORDER BY position ASC LIMIT 1", updatedProjectID).Scan(&updatedBucket)
					if errB2 != nil {
						common.SendError(w, http.StatusInternalServerError, "Target project has no columns")
						return
					}
				}
			}

			if _, ok := raw["bucket"]; ok && req.Bucket != nil && *req.Bucket != existing.Bucket {
				var bDummy string
				errB := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", updatedProjectID, updatedBucket).Scan(&bDummy)
				if errB == sql.ErrNoRows {
					if updatedBucket == "done" || updatedBucket == "archive" {
						var maxPos sql.NullFloat64
						_ = tx.QueryRow("SELECT MAX(position) FROM buckets WHERE project_id = ?", updatedProjectID).Scan(&maxPos)
						newPosition := 1000.0
						if maxPos.Valid {
							newPosition = maxPos.Float64 + 1000.0
						}

						title := "Done"
						if updatedBucket == "archive" {
							title = "Archive"
						}

						_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, '', ?, NULL, 'list', NULL, 0)",
							updatedProjectID, updatedBucket, title, newPosition)
						if err != nil {
							common.SendError(w, http.StatusInternalServerError, err.Error())
							return
						}
					} else {
						common.SendError(w, http.StatusBadRequest, fmt.Sprintf("Bucket '%s' does not exist in project '%s'.", updatedBucket, updatedProjectID))
						return
					}
				} else if errB != nil {
					common.SendError(w, http.StatusInternalServerError, errB.Error())
					return
				}
			}

			taskMap := map[string]interface{}{
				"project_id":   updatedProjectID,
				"title":        updatedTitle,
				"bucket":       updatedBucket,
				"position":     updatedPosition,
				"tags":         updatedTags,
				"attachments":  updatedAttachments,
				"body":         updatedBody,
				"due_date":     updatedDueDate,
				"planned_date": updatedPlannedDate,
				"priority":     updatedPriority,
				"color":        updatedColor,
				"created_at":   existing.CreatedAt,
				"updated_at":   nowStr,
			}

			filename, errWrite := WriteTaskFile(tasksDir, taskID, taskMap)
			if errWrite != nil {
				log.Printf("ERROR: Failed to write task file for task %s: %v", taskID, errWrite)
				common.SendError(w, http.StatusInternalServerError, "Failed to write task file")
				return
			}

			tagsJSON, _ := json.Marshal(updatedTags)
			attachmentsJSON, _ := json.Marshal(updatedAttachments)
			var dbDueDate, dbPlannedDate, dbPriority, dbColor sql.NullString
			if updatedDueDate != nil {
				dbDueDate = sql.NullString{String: *updatedDueDate, Valid: true}
			}
			if updatedPlannedDate != nil {
				dbPlannedDate = sql.NullString{String: *updatedPlannedDate, Valid: true}
			}
			if updatedPriority != nil {
				dbPriority = sql.NullString{String: *updatedPriority, Valid: true}
			}
			if updatedColor != nil {
				dbColor = sql.NullString{String: *updatedColor, Valid: true}
			}

			_, err = tx.Exec("UPDATE tasks SET project_id = ?, title = ?, bucket = ?, position = ?, tags = ?, attachments = ?, filename = ?, body = ?, due_date = ?, planned_date = ?, priority = ?, color = ?, updated_at = ? WHERE id = ? AND project_id = ?",
				updatedProjectID, updatedTitle, updatedBucket, updatedPosition, string(tagsJSON), string(attachmentsJSON), filename, updatedBody, dbDueDate, dbPlannedDate, dbPriority, dbColor, nowStr, taskID, projectID)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if err := tx.Commit(); err != nil {
				log.Printf("ERROR: TX commit failed for task %s: %v", taskID, err)
				common.SendError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if updatedProjectID != existing.ProjectID {
				_ = bucket.SyncBucketsFile(tasksDir, existing.ProjectID)
				_ = bucket.SyncBucketsFile(tasksDir, updatedProjectID)
			} else if _, ok := raw["bucket"]; ok && (updatedBucket == "done" || updatedBucket == "archive") {
				_ = bucket.SyncBucketsFile(tasksDir, projectID)
			}

			res := Response{
				ID:          taskID,
				ProjectID:   updatedProjectID,
				Title:       updatedTitle,
				Bucket:      updatedBucket,
				Position:    updatedPosition,
				Tags:        updatedTags,
				Attachments: updatedAttachments,
				Body:        updatedBody,
				DueDate:     updatedDueDate,
				PlannedDate: updatedPlannedDate,
				Priority:    updatedPriority,
				Color:       updatedColor,
				CreatedAt:   existing.CreatedAt,
				UpdatedAt:   nowStr,
			}
			common.SendJSON(w, http.StatusOK, res)
		}

		r.Put("/", updateHandler)
		r.Patch("/", updateHandler)

		// --- Attachment Endpoints ---
		r.Post("/attachments", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")

			err := r.ParseMultipartForm(32 << 20) // 32MB max
			if err != nil {
				common.SendError(w, http.StatusBadRequest, "Failed to parse multipart form")
				return
			}

			file, header, err := r.FormFile("file")
			if err != nil {
				common.SendError(w, http.StatusBadRequest, "No file provided")
				return
			}
			defer file.Close()

			attachmentsDir := filepath.Join(tasksDir, projectID, taskID+".attachments")
			_ = os.MkdirAll(attachmentsDir, 0755)

			dstPath := filepath.Join(attachmentsDir, header.Filename)
			dst, err := os.Create(dstPath)
			if err != nil {
				common.SendError(w, http.StatusInternalServerError, "Failed to create destination file")
				return
			}
			defer dst.Close()

			if _, err := io.Copy(dst, file); err != nil {
				common.SendError(w, http.StatusInternalServerError, "Failed to save file")
				return
			}

			// Update Task Metadata
			existing, errRead := ReadTaskFile(tasksDir, taskID)
			if errRead != nil {
				common.SendError(w, http.StatusInternalServerError, "Failed to read task metadata")
				return
			}

			// Check if already exists in list
			found := false
			for _, a := range existing.Attachments {
				if a == header.Filename {
					found = true
					break
				}
			}

			if !found {
				existing.Attachments = append(existing.Attachments, header.Filename)

				taskMap := map[string]interface{}{
					"project_id":   existing.ProjectID,
					"title":        existing.Title,
					"bucket":       existing.Bucket,
					"position":     existing.Position,
					"tags":         existing.Tags,
					"attachments":  existing.Attachments,
					"body":         existing.Body,
					"due_date":     existing.DueDate,
					"planned_date": existing.PlannedDate,
					"priority: ":   existing.Priority,
					"color":        existing.Color,
					"created_at":   existing.CreatedAt,
					"updated_at":   existing.UpdatedAt,
				}

				_, errWrite := WriteTaskFile(tasksDir, taskID, taskMap)
				if errWrite != nil {
					common.SendError(w, http.StatusInternalServerError, "Failed to update task file")
					return
				}

				attJSON, _ := json.Marshal(existing.Attachments)
				_, _ = db.DB.Exec("UPDATE tasks SET attachments = ? WHERE id = ? AND project_id = ?", string(attJSON), taskID, projectID)
			}

			common.SendJSON(w, http.StatusOK, existing)
		})

		r.Get("/attachments/{filename}", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")
			filename := chi.URLParam(r, "filename")

			filePath := filepath.Join(tasksDir, projectID, taskID+".attachments", filename)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				http.NotFound(w, r)
				return
			}

			http.ServeFile(w, r, filePath)
		})

		r.Delete("/attachments/{filename}", func(w http.ResponseWriter, r *http.Request) {
			projectID := chi.URLParam(r, "project_id")
			taskID := chi.URLParam(r, "task_id")
			filename := chi.URLParam(r, "filename")

			filePath := filepath.Join(tasksDir, projectID, taskID+".attachments", filename)
			_ = os.Remove(filePath)

			// Update Metadata
			existing, errRead := ReadTaskFile(tasksDir, taskID)
			if errRead == nil {
				var newAtt []string
				for _, a := range existing.Attachments {
					if a != filename {
						newAtt = append(newAtt, a)
					}
				}
				existing.Attachments = newAtt

				taskMap := map[string]interface{}{
					"project_id":   existing.ProjectID,
					"title":        existing.Title,
					"bucket":       existing.Bucket,
					"position":     existing.Position,
					"tags":         existing.Tags,
					"attachments":  existing.Attachments,
					"body":         existing.Body,
					"due_date":     existing.DueDate,
					"planned_date": existing.PlannedDate,
					"priority":     existing.Priority,
					"color":        existing.Color,
					"created_at":   existing.CreatedAt,
					"updated_at":   existing.UpdatedAt,
				}

				_, _ = WriteTaskFile(tasksDir, taskID, taskMap)
				attJSON, _ := json.Marshal(existing.Attachments)
				_, _ = db.DB.Exec("UPDATE tasks SET attachments = ? WHERE id = ? AND project_id = ?", string(attJSON), taskID, projectID)
			}

			common.SendJSON(w, http.StatusOK, existing)
		})
	})

	r.Patch("/projects/{project_id}/tasks/{task_id}/move", func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "project_id")
		taskID := chi.URLParam(r, "task_id")

		var req Move
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			common.SendError(w, http.StatusBadRequest, "Invalid request payload")
			return
		}

		existing, errRead := ReadTaskFile(tasksDir, taskID)
		if errRead != nil || existing.ProjectID != projectID {
			common.SendError(w, http.StatusNotFound, fmt.Sprintf("Task with ID %s not found in project '%s'", taskID, projectID))
			return
		}

		tx, err := db.DB.Begin()
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer func() { _ = tx.Rollback() }()

		// Verify target bucket exists for this project
		var bDummy string
		errB := tx.QueryRow("SELECT name FROM buckets WHERE project_id = ? AND name = ?", projectID, req.Bucket).Scan(&bDummy)
		if errB == sql.ErrNoRows {
			if req.Bucket == "done" || req.Bucket == "archive" {
				var maxPos sql.NullFloat64
				_ = tx.QueryRow("SELECT MAX(position) FROM buckets WHERE project_id = ?", projectID).Scan(&maxPos)
				newPosition := 1000.0
				if maxPos.Valid {
					newPosition = maxPos.Float64 + 1000.0
				}

				title := "Done"
				if req.Bucket == "archive" {
					title = "Archive"
				}

				_, err = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, '', ?, NULL, 'list', NULL, 0)",
					projectID, req.Bucket, title, newPosition)
				if err != nil {
					common.SendError(w, http.StatusInternalServerError, err.Error())
					return
				}
			} else {
				common.SendError(w, http.StatusBadRequest, fmt.Sprintf("Bucket '%s' does not exist in project '%s'.", req.Bucket, projectID))
				return
			}
		} else if errB != nil {
			common.SendError(w, http.StatusInternalServerError, errB.Error())
			return
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		nowStr = strings.Replace(nowStr, "+00:00", "Z", 1)

		taskMap := map[string]interface{}{
			"project_id":   projectID,
			"title":        existing.Title,
			"bucket":       req.Bucket,
			"position":     req.Position,
			"tags":         existing.Tags,
			"body":         existing.Body,
			"due_date":     existing.DueDate,
			"planned_date": existing.PlannedDate,
			"priority":     existing.Priority,
			"color":        existing.Color,
			"created_at":   existing.CreatedAt,
			"updated_at":   nowStr,
		}

		filename, errWrite := WriteTaskFile(tasksDir, taskID, taskMap)
		if errWrite != nil {
			common.SendError(w, http.StatusInternalServerError, "Failed to write task file")
			return
		}

		_, err = tx.Exec("UPDATE tasks SET bucket = ?, position = ?, filename = ?, updated_at = ? WHERE id = ? AND project_id = ?",
			req.Bucket, req.Position, filename, nowStr, taskID, projectID)
		if err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			common.SendError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if req.Bucket == "done" || req.Bucket == "archive" {
			_ = bucket.SyncBucketsFile(tasksDir, projectID)
		}

		res := Response{
			ID:          taskID,
			ProjectID:   projectID,
			Title:       existing.Title,
			Bucket:      req.Bucket,
			Position:    req.Position,
			Tags:        existing.Tags,
			Body:        existing.Body,
			DueDate:     existing.DueDate,
			PlannedDate: existing.PlannedDate,
			Priority:    existing.Priority,
			Color:       existing.Color,
			CreatedAt:   existing.CreatedAt,
			UpdatedAt:   nowStr,
		}
		common.SendJSON(w, http.StatusOK, res)
	})
}
