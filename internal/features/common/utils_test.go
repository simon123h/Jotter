package common

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"Jotter - Local-First", "jotter-local-first"},
		{"Project 123!", "project-123"},
		{"  Spaces  And--Dashes  ", "spaces-and-dashes"},
		{"UPPER CASE", "upper-case"},
	}

	for _, tt := range tests {
		if res := Slugify(tt.input); res != tt.expected {
			t.Errorf("Slugify(%q) = %q, want %q", tt.input, res, tt.expected)
		}
	}
}

func TestGenerateULID(t *testing.T) {
	id1 := GenerateULID()
	id2 := GenerateULID()

	if len(id1) != 26 {
		t.Errorf("Generated ULID length = %d, want 26", len(id1))
	}
	if id1 == id2 {
		t.Errorf("Consecutive ULIDs are identical: %s", id1)
	}
}
