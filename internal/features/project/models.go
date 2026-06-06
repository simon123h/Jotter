package project

type Create struct {
	Title           string  `json:"title"`
	DoneCleanPeriod *int    `json:"done_clean_period,omitempty"`
	GitRemote       *string `json:"git_remote,omitempty"`
}

type Update struct {
	Title           *string `json:"title,omitempty"`
	DoneCleanPeriod *int    `json:"done_clean_period,omitempty"`
	GitRemote       *string `json:"git_remote,omitempty"`
}

type Response struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	CreatedAt       string  `json:"created_at"`
	DoneCleanPeriod *int    `json:"done_clean_period"`
	GitRemote       *string `json:"git_remote"`
}
