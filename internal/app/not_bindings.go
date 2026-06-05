//go:build !bindings

package app

// This is false during standard execution and final binary builds
const IsGeneratingBindings = false
