package system

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"jotter/backend/internal/db"
	"jotter/backend/internal/features/project"
	"jotter/backend/internal/features/task"
)

func SyncDBWithFiles(tasksDir string) (int, error) {
	// 1. Sync Projects first
	projectsData, err := project.LoadProjectsFile(tasksDir)
	if err != nil {
		return 0, err
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	// Clear existing tasks and buckets before rebuilding index
	_, _ = tx.Exec("DELETE FROM tasks")
	_, _ = tx.Exec("DELETE FROM buckets")
	_, _ = tx.Exec("DELETE FROM projects")

	for _, p := range projectsData {
		pID := p["id"].(string)
		title := p["title"].(string)
		created := p["created_at"].(string)

		var doneCleanPeriod sql.NullInt64
		if p["done_clean_period"] != nil {
			switch v := p["done_clean_period"].(type) {
			case float64:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int:
				doneCleanPeriod = sql.NullInt64{Int64: int64(v), Valid: true}
			case int64:
				doneCleanPeriod = sql.NullInt64{Int64: v, Valid: true}
			}
		}

		var gitRemote sql.NullString
		if p["git_remote"] != nil {
			if r, ok := p["git_remote"].(string); ok {
				gitRemote = sql.NullString{String: r, Valid: true}
			}
		}

		_, err = tx.Exec("INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
			pID, title, created, doneCleanPeriod, gitRemote)
		if err != nil {
			return 0, err
		}
	}

	// 2. Sync Buckets and Tasks
	projects, err := os.ReadDir(tasksDir)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, p := range projects {
		if !p.IsDir() || strings.HasPrefix(p.Name(), ".") {
			continue
		}
		pID := p.Name()
		projectDir := filepath.Join(tasksDir, pID)

		// 1. Load Buckets
		bucketsFile := filepath.Join(projectDir, "buckets.json")
		if _, err := os.Stat(bucketsFile); err == nil {
			data, _ := os.ReadFile(bucketsFile)
			var buckets []map[string]interface{}
			if err := json.Unmarshal(data, &buckets); err == nil {
				for _, b := range buckets {
					bName := b["name"].(string)
					bTitle := b["title"].(string)
					bSubtitle, _ := b["subtitle"].(string)
					bPos := b["position"].(float64)
					bLayout, _ := b["layout"].(string)
					if bLayout == "" {
						bLayout = "list"
					}
					bDefault, _ := b["is_default"].(bool)

					var bColor sql.NullString
					if c, ok := b["color"].(string); ok {
						bColor = sql.NullString{String: c, Valid: true}
					}

					var bMaxTasks sql.NullInt64
					if m, ok := b["max_tasks"].(float64); ok {
						bMaxTasks = sql.NullInt64{Int64: int64(m), Valid: true}
					}

					_, _ = tx.Exec("INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
						pID, bName, bTitle, bSubtitle, bPos, bColor, bLayout, bMaxTasks, bDefault)
				}
			}
		}

		// 2. Load Tasks
		files, err := os.ReadDir(projectDir)
		if err != nil {
			continue
		}

		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".md") {
				continue
			}

			data, err := os.ReadFile(filepath.Join(projectDir, f.Name()))
			if err != nil {
				continue
			}

			fm, body, err := task.ParseFrontmatter(string(data))
			if err == nil {
				taskID := strings.TrimSuffix(f.Name(), ".md")

				// --- Done Task Auto-Pruning ---
				var doneCleanPeriod sql.NullInt64
				_ = tx.QueryRow("SELECT done_clean_period FROM projects WHERE id = ?", pID).Scan(&doneCleanPeriod)

				if doneCleanPeriod.Valid && doneCleanPeriod.Int64 > 0 && fm.Bucket == "done" {
					updatedAt, errTime := time.Parse(time.RFC3339Nano, fm.UpdatedAt)
					if errTime == nil {
						ageDays := int64(time.Since(updatedAt).Hours() / 24)
						if ageDays >= doneCleanPeriod.Int64 {
							// Prune this task
							_ = os.Remove(filepath.Join(projectDir, f.Name()))
							attachmentsDir := filepath.Join(projectDir, taskID+".attachments")
							_ = os.RemoveAll(attachmentsDir)
							continue
						}
					}
				}
				// ------------------------------

				idVal := fm.ID
				if idVal == "" {
					idVal = taskID
				}

				tagsJSON, _ := json.Marshal(fm.Tags)
				attachmentsJSON, _ := json.Marshal(fm.Attachments)
				var fmDueDate, fmPlannedDate, fmPriority, fmColor sql.NullString
				if fm.DueDate != nil {
					fmDueDate = sql.NullString{String: *fm.DueDate, Valid: true}
				}
				if fm.PlannedDate != nil {
					fmPlannedDate = sql.NullString{String: *fm.PlannedDate, Valid: true}
				}
				if fm.Priority != nil {
					fmPriority = sql.NullString{String: *fm.Priority, Valid: true}
				}
				if fm.Color != nil {
					fmColor = sql.NullString{String: *fm.Color, Valid: true}
				}

				_, errT := tx.Exec("INSERT INTO tasks (id, project_id, title, bucket, position, tags, attachments, filename, body, due_date, planned_date, priority, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					idVal, pID, fm.Title, fm.Bucket, fm.Position, string(tagsJSON), string(attachmentsJSON), f.Name(), body, fmDueDate, fmPlannedDate, fmPriority, fmColor, fm.CreatedAt, fm.UpdatedAt)
				if errT != nil {
					log.Printf("Error inserting task %s: %v", idVal, errT)
					continue
				}
				count++
			}		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}
