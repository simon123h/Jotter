package storage

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// GitSync performs a git pull/commit/push cycle on the tasks directory
func GitSync(tasksDir string) error {
	// 1. Check if it's a git repo
	if _, err := os.Stat(filepath.Join(tasksDir, ".git")); os.IsNotExist(err) {
		return nil // Not a git repo, skip silently
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 2. Add and Commit local changes
	// We ignore the error here because it might fail if there are no changes
	_ = runGit(ctx, tasksDir, "add", ".")
	_ = runGit(ctx, tasksDir, "commit", "-m", fmt.Sprintf("Auto-sync from Jotter: %s", time.Now().Format(time.RFC3339)))

	// 3. Fetch
	if err := runGit(ctx, tasksDir, "fetch", "origin"); err != nil {
		return fmt.Errorf("git fetch failed: %v", err)
	}

	// 4. Try FF-only merge
	// We check the current branch first
	branch, err := getCurrentBranch(ctx, tasksDir)
	if err != nil {
		return err
	}

	remoteBranch := "origin/" + branch
	
	// Try fast-forward
	errFF := runGit(ctx, tasksDir, "merge", "--ff-only", remoteBranch)
	if errFF == nil {
		// FF success, just push and done
		_ = runGit(ctx, tasksDir, "push", "origin", branch)
		return nil
	}

	// 5. If FF failed, try a real merge (no rebase)
	errMerge := runGit(ctx, tasksDir, "merge", "--no-rebase", remoteBranch)
	if errMerge != nil {
		// CONFLICT or other error
		_ = runGit(ctx, tasksDir, "merge", "--abort")
		return fmt.Errorf("merge conflict detected - please solve manually in your tasks folder")
	}

	// 6. Push success
	if err := runGit(ctx, tasksDir, "push", "origin", branch); err != nil {
		return fmt.Errorf("git push failed: %v", err)
	}

	return nil
}

func runGit(ctx context.Context, dir string, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	// We capture combined output to help debugging if needed
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s (output: %s)", err, string(output))
	}
	return nil
}

func getCurrentBranch(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "main", nil // Fallback
	}
	return string(out[:len(out)-1]), nil
}
