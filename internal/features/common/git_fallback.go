//go:build !windows

package common

import "os/exec"

// prepareCmd is a no-op on non-Windows platforms.
func prepareCmd(cmd *exec.Cmd) {}
