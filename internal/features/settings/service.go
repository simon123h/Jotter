package settings

import "context"

// Service coordinates business logic for settings
type Service interface {
	GetSettings(ctx context.Context, tasksDir string) (AppSettings, error)
	SaveSettings(ctx context.Context, tasksDir string, settings AppSettings) error
}

type settingsService struct {
	fileRepo FileRepository
}

// NewService creates a new settings service instance
func NewService(fileRepo FileRepository) Service {
	return &settingsService{
		fileRepo: fileRepo,
	}
}

func (s *settingsService) GetSettings(ctx context.Context, tasksDir string) (AppSettings, error) {
	return s.fileRepo.LoadSettings(tasksDir)
}

func (s *settingsService) SaveSettings(ctx context.Context, tasksDir string, settings AppSettings) error {
	return s.fileRepo.SaveSettings(tasksDir, settings)
}
