package models

// Project DTOs
type ProjectCreate struct {
	Title           string  `json:"title"`
	DoneCleanPeriod *int    `json:"done_clean_period,omitempty"`
	GitRemote       *string `json:"git_remote,omitempty"`
}

type ProjectUpdate struct {
	Title           *string `json:"title,omitempty"`
	DoneCleanPeriod *int    `json:"done_clean_period,omitempty"`
	GitRemote       *string `json:"git_remote,omitempty"`
}

type ProjectResponse struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	CreatedAt       string  `json:"created_at"`
	DoneCleanPeriod *int    `json:"done_clean_period"`
	GitRemote       *string `json:"git_remote"`
}

// Task DTOs
type TaskCreate struct {
	Title    string   `json:"title"`
	Bucket   string   `json:"bucket"`
	Tags     []string `json:"tags"`
	Body     string   `json:"body"`
	DueDate  *string  `json:"due_date"`
	Priority *string  `json:"priority"`
	Color    *string  `json:"color"`
}

type TaskUpdate struct {
	Title    *string   `json:"title,omitempty"`
	Bucket   *string   `json:"bucket,omitempty"`
	Tags     *[]string `json:"tags,omitempty"`
	Body     *string   `json:"body,omitempty"`
	Position *float64  `json:"position,omitempty"`
	DueDate  *string   `json:"due_date,omitempty"`
	Priority *string   `json:"priority,omitempty"`
	Color    *string   `json:"color,omitempty"`
}

type TaskMove struct {
	Bucket   string  `json:"bucket"`
	Position float64 `json:"position"`
}

type TaskResponse struct {
	ID        string   `json:"id"`
	ProjectID string   `json:"project_id"`
	Title     string   `json:"title"`
	Bucket    string   `json:"bucket"`
	Position  float64  `json:"position"`
	Tags      []string `json:"tags"`
	Body      string   `json:"body"`
	DueDate   *string  `json:"due_date"`
	Priority  *string  `json:"priority"`
	Color     *string  `json:"color"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

// Bucket DTOs
type BucketCreate struct {
	Title     string  `json:"title"`
	Subtitle  *string `json:"subtitle,omitempty"`
	Color     *string `json:"color,omitempty"`
	Layout    *string `json:"layout,omitempty"`
	MaxTasks  *int    `json:"max_tasks,omitempty"`
	IsDefault *bool   `json:"is_default,omitempty"`
}

type BucketUpdate struct {
	Title     *string  `json:"title,omitempty"`
	Subtitle  *string  `json:"subtitle,omitempty"`
	Position  *float64 `json:"position,omitempty"`
	Color     *string  `json:"color,omitempty"`
	Layout    *string  `json:"layout,omitempty"`
	MaxTasks  *int     `json:"max_tasks,omitempty"`
	IsDefault *bool    `json:"is_default,omitempty"`
}

type BucketResponse struct {
	Name      string  `json:"name"`
	Title     string  `json:"title"`
	Subtitle  string  `json:"subtitle"`
	Position  float64 `json:"position"`
	Color     *string `json:"color"`
	Layout    string  `json:"layout"`
	MaxTasks  *int    `json:"max_tasks"`
	IsDefault bool    `json:"is_default"`
}
