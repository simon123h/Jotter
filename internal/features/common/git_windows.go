//go:build windows

package common

import (
	"os/exec"
	"syscall"
)

// PrepareCmd configures the command's system attributes to suppress terminal window popping on Windows.
func PrepareCmd(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
}
