package bucket

type Create struct {
	Title     string  `json:"title"`
	Subtitle  *string `json:"subtitle,omitempty"`
	Color     *string `json:"color,omitempty"`
	Layout    *string `json:"layout,omitempty"`
	MaxTasks  *int    `json:"max_tasks,omitempty"`
	IsDefault *bool   `json:"is_default,omitempty"`
}

type Update struct {
	Title     *string  `json:"title,omitempty"`
	Subtitle  *string  `json:"subtitle,omitempty"`
	Position  *float64 `json:"position,omitempty"`
	Color     *string  `json:"color,omitempty"`
	Layout    *string  `json:"layout,omitempty"`
	MaxTasks  *int     `json:"max_tasks,omitempty"`
	IsDefault *bool    `json:"is_default,omitempty"`
}

type Response struct {
	Name      string  `json:"name"`
	Title     string  `json:"title"`
	Subtitle  string  `json:"subtitle"`
	Position  float64 `json:"position"`
	Color     *string `json:"color"`
	Layout    string  `json:"layout"`
	MaxTasks  *int    `json:"max_tasks"`
	IsDefault bool    `json:"is_default"`
}
