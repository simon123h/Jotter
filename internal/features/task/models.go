package task

type Create struct {
	Title          string   `json:"title"`
	Bucket         string   `json:"bucket"`
	Tags           []string `json:"tags"`
	Body           string   `json:"body"`
	DueDate        *string  `json:"due_date,omitempty"`
	PlannedDate    *string  `json:"planned_date,omitempty"`
	Priority       *string  `json:"priority,omitempty"`
	Color          *string  `json:"color,omitempty"`
	PostponedUntil *string  `json:"postponed_until,omitempty"`
}

type Update struct {
	ProjectID      *string   `json:"project_id,omitempty"`
	Title          *string   `json:"title,omitempty"`
	Bucket         *string   `json:"bucket,omitempty"`
	Position       *float64  `json:"position,omitempty"`
	Tags           *[]string `json:"tags,omitempty"`
	Attachments    *[]string `json:"attachments,omitempty"`
	Body           *string   `json:"body,omitempty"`
	DueDate        *string   `json:"due_date,omitempty"`
	PlannedDate    *string   `json:"planned_date,omitempty"`
	Priority       *string   `json:"priority,omitempty"`
	Color          *string   `json:"color,omitempty"`
	PostponedUntil *string   `json:"postponed_until,omitempty"`
}

type Move struct {
	Bucket   string  `json:"bucket"`
	Position float64 `json:"position"`
}

type Response struct {
	ID             string   `json:"id"`
	ProjectID      string   `json:"project_id"`
	Title          string   `json:"title"`
	Bucket         string   `json:"bucket"`
	Position       float64  `json:"position"`
	Tags           []string `json:"tags"`
	Attachments    []string `json:"attachments"`
	Body           string   `json:"body"`
	DueDate        *string  `json:"due_date"`
	PlannedDate    *string  `json:"planned_date"`
	Priority       *string  `json:"priority"`
	Color          *string  `json:"color"`
	PostponedUntil *string  `json:"postponed_until"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

type Frontmatter struct {
	ID             string   `yaml:"id"`
	ProjectID      string   `yaml:"project_id"`
	Title          string   `yaml:"title"`
	Bucket         string   `yaml:"bucket"`
	Position       float64  `yaml:"position"`
	Tags           []string `yaml:"tags"`
	Attachments    []string `yaml:"attachments,omitempty"`
	DueDate        *string  `yaml:"due_date"`
	PlannedDate    *string  `yaml:"planned_date"`
	Priority       *string  `yaml:"priority"`
	Color          *string  `yaml:"color"`
	PostponedUntil *string  `yaml:"postponed_until"`
	CreatedAt      string   `yaml:"created_at"`
	UpdatedAt      string   `yaml:"updated_at"`
}
