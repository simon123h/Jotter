package settings

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"jotter/backend/internal/features/common"
)

type Handler struct {
	svc      Service
	tasksDir string
}

func RegisterRoutes(r chi.Router, tasksDir string) {
	fileRepo := NewFileRepository()
	svc := NewService(fileRepo)
	h := &Handler{svc: svc, tasksDir: tasksDir}

	r.Get("/settings", h.GetSettings)
	r.Post("/settings", h.SaveSettings)
}

// GetSettings godoc
// @Summary      Get user settings
// @Description  Get global user settings for the application
// @Tags         settings
// @Produce      json
// @Success      200  {object}  AppSettings
// @Failure      500  {object}  common.ErrorResponse
// @Router       /settings [get]
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	appSettings, err := h.svc.GetSettings(r.Context(), h.tasksDir)
	if err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	common.SendJSON(w, http.StatusOK, appSettings)
}

// SaveSettings godoc
// @Summary      Save user settings
// @Description  Update and save global user settings
// @Tags         settings
// @Accept       json
// @Produce      json
// @Param        settings  body      AppSettings  true  "User Settings"
// @Success      200       {object}  map[string]string
// @Failure      400       {object}  common.ErrorResponse
// @Failure      500       {object}  common.ErrorResponse
// @Router       /settings [post]
func (h *Handler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	var appSettings AppSettings
	if err := json.NewDecoder(r.Body).Decode(&appSettings); err != nil {
		common.SendError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if err := h.svc.SaveSettings(r.Context(), h.tasksDir, appSettings); err != nil {
		common.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	common.SendJSON(w, http.StatusOK, map[string]string{"status": "success"})
}
