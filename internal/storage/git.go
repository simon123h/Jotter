package storage

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// GitSync performs a git pull/commit/push cycle on a specific project directory.
// If a remoteURL is provided, it ensures the project is initialized and connected to it.
func GitSync(projectDir string, remoteURL string) error {
	// 1. Ensure directory exists
	if _, err := os.Stat(projectDir); os.IsNotExist(err) {
		_ = os.MkdirAll(projectDir, 0755)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 2. Check if it's already a git repo
	isGit := true
	if _, err := os.Stat(filepath.Join(projectDir, ".git")); os.IsNotExist(err) {
		isGit = false
	}

	if !isGit && remoteURL != "" {
		// New remote added to existing folder or completely new project
		// We try to clone or init
		_ = runGit(ctx, projectDir, "init")
		_ = runGit(ctx, projectDir, "remote", "add", "origin", remoteURL)
		isGit = true
	}

	if !isGit {
		return nil // Not a git repo and no remote provided, skip silently
	}

	// 3. Ensure remote matches if provided
	if remoteURL != "" {
		// Check current remote
		currentRemote, _ := getRemoteURL(ctx, projectDir)
		if currentRemote != remoteURL {
			_ = runGit(ctx, projectDir, "remote", "set-url", "origin", remoteURL)
		}
	}

	// 4. Check if origin exists before proceeding
	if !hasRemoteOrigin(ctx, projectDir) {
		return nil // No remote configured, nothing to sync with
	}

	// 5. Add and Commit local changes
	_ = runGit(ctx, projectDir, "add", ".")
	_ = runGit(ctx, projectDir, "commit", "-m", fmt.Sprintf("Auto-sync from Jotter: %s", time.Now().Format(time.RFC3339)))

	// 6. Fetch
	if err := runGit(ctx, projectDir, "fetch", "origin"); err != nil {
		// If fetch fails, it might be a fresh repo without a remote history
		// We ignore this for now to allow the first push
	}

	// 6. Branch handling
	branch, err := getCurrentBranch(ctx, projectDir)
	if err != nil {
		branch = "main"
	}

	remoteBranch := "origin/" + branch

	// 7. Try FF-only merge (only if remote branch exists)
	if hasRemoteBranch(ctx, projectDir, remoteBranch) {
		errFF := runGit(ctx, projectDir, "merge", "--ff-only", remoteBranch)
		if errFF != nil {
			// Real merge
			errMerge := runGit(ctx, projectDir, "merge", "--no-rebase", remoteBranch)
			if errMerge != nil {
				_ = runGit(ctx, projectDir, "merge", "--abort")
				return fmt.Errorf("merge conflict detected - please solve manually in project folder")
			}
		}
	}

	// 8. Push
	if err := runGit(ctx, projectDir, "push", "origin", branch); err != nil {
		return fmt.Errorf("git push failed: %v", err)
	}

	return nil
}

func hasRemoteOrigin(ctx context.Context, dir string) bool {
	cmd := exec.CommandContext(ctx, "git", "remote", "show", "origin")
	cmd.Dir = dir
	return cmd.Run() == nil
}

func getRemoteURL(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "remote", "get-url", "origin")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func hasRemoteBranch(ctx context.Context, dir, branch string) bool {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--verify", branch)
	cmd.Dir = dir
	return cmd.Run() == nil
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
