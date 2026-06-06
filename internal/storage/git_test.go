package storage

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestGitSync(t *testing.T) {
	t.Run("Non-Git Directory", func(t *testing.T) {
		tempDir, _ := os.MkdirTemp("", "git-test-non-*")
		defer os.RemoveAll(tempDir)

		err := GitSync(tempDir)
		if err != nil {
			t.Errorf("Expected nil error for non-git dir, got: %v", err)
		}
	})

	t.Run("Git Dir Without Remote", func(t *testing.T) {
		tempDir, _ := os.MkdirTemp("", "git-test-no-remote-*")
		defer os.RemoveAll(tempDir)

		ctx := context.Background()
		_ = runGit(ctx, tempDir, "init")
		// Ensure a branch exists
		_ = runGit(ctx, tempDir, "checkout", "-b", "main")

		err := GitSync(tempDir)
		if err == nil {
			t.Error("Expected error because origin is missing")
		} else if !strings.Contains(err.Error(), "git fetch failed") {
			t.Errorf("Unexpected error message: %v", err)
		}
	})

	t.Run("Full Sync Flow", func(t *testing.T) {
		// 1. Create a "remote" repository
		remoteDir, _ := os.MkdirTemp("", "git-remote-*")
		defer os.RemoveAll(remoteDir)
		ctx := context.Background()
		_ = runGit(ctx, remoteDir, "init", "--bare")
		// Explicitly set default branch on remote to main
		_ = runGit(ctx, remoteDir, "symbolic-ref", "HEAD", "refs/heads/main")

		// 2. Create local repository
		localDir, _ := os.MkdirTemp("", "git-local-*")
		defer os.RemoveAll(localDir)
		_ = runGit(ctx, localDir, "init")
		_ = runGit(ctx, localDir, "checkout", "-b", "main")
		_ = runGit(ctx, localDir, "remote", "add", "origin", remoteDir)

		// 3. Configure git user for tests
		_ = runGit(ctx, localDir, "config", "user.email", "test@example.com")
		_ = runGit(ctx, localDir, "config", "user.name", "Test User")
		_ = runGit(ctx, localDir, "config", "push.default", "current")

		// 4. Create initial commit and push
		_ = os.WriteFile(filepath.Join(localDir, "initial.md"), []byte("hello"), 0644)
		_ = runGit(ctx, localDir, "add", ".")
		_ = runGit(ctx, localDir, "commit", "-m", "Initial commit")
		_ = runGit(ctx, localDir, "push", "-u", "origin", "main")

		// 5. Test GitSync (with local changes)
		_ = os.WriteFile(filepath.Join(localDir, "task1.md"), []byte("new task"), 0644)
		err := GitSync(localDir)
		if err != nil {
			t.Fatalf("GitSync failed: %v", err)
		}

		// 6. Verify remote has the changes
		verifyDir, _ := os.MkdirTemp("", "git-verify-*")
		defer os.RemoveAll(verifyDir)
		_ = runGit(ctx, verifyDir, "clone", remoteDir, ".")
		if _, err := os.Stat(filepath.Join(verifyDir, "task1.md")); os.IsNotExist(err) {
			t.Error("Changes were not pushed to remote")
		}
	})

	t.Run("Merge Conflict Handling", func(t *testing.T) {
		// 1. Setup remote and local
		remoteDir, _ := os.MkdirTemp("", "git-conflict-remote-*")
		defer os.RemoveAll(remoteDir)
		ctx := context.Background()
		_ = runGit(ctx, remoteDir, "init", "--bare")
		_ = runGit(ctx, remoteDir, "symbolic-ref", "HEAD", "refs/heads/main")

		localDir, _ := os.MkdirTemp("", "git-conflict-local-*")
		defer os.RemoveAll(localDir)
		_ = runGit(ctx, localDir, "init")
		_ = runGit(ctx, localDir, "checkout", "-b", "main")
		_ = runGit(ctx, localDir, "remote", "add", "origin", remoteDir)
		_ = runGit(ctx, localDir, "config", "user.email", "test@example.com")
		_ = runGit(ctx, localDir, "config", "user.name", "Test User")

		// Initial setup
		_ = os.WriteFile(filepath.Join(localDir, "conflict.md"), []byte("initial"), 0644)
		_ = runGit(ctx, localDir, "add", ".")
		_ = runGit(ctx, localDir, "commit", "-m", "Initial")
		_ = runGit(ctx, localDir, "push", "-u", "origin", "main")

		// 2. Create another local to simulate remote change
		otherDir, _ := os.MkdirTemp("", "git-conflict-other-*")
		defer os.RemoveAll(otherDir)
		_ = runGit(ctx, otherDir, "clone", remoteDir, ".")
		_ = runGit(ctx, otherDir, "config", "user.email", "test@example.com")
		_ = runGit(ctx, otherDir, "config", "user.name", "Test User")
		_ = os.WriteFile(filepath.Join(otherDir, "conflict.md"), []byte("remote changed"), 0644)
		_ = runGit(ctx, otherDir, "add", ".")
		_ = runGit(ctx, otherDir, "commit", "-m", "Remote update")
		_ = runGit(ctx, otherDir, "push", "origin", "main")

		// 3. Edit same file in localDir to create conflict
		_ = os.WriteFile(filepath.Join(localDir, "conflict.md"), []byte("local changed"), 0644)

		// 4. Run GitSync - should fail with conflict message
		err := GitSync(localDir)
		if err == nil {
			t.Error("Expected conflict error, got nil")
		} else if !strings.Contains(err.Error(), "merge conflict detected") {
			t.Errorf("Expected conflict error message, got: %v", err)
		}

		// 5. Verify we are in a clean state (abort worked)
		statusCmd := exec.Command("git", "status")
		statusCmd.Dir = localDir
		out, _ := statusCmd.Output()
		if strings.Contains(string(out), "You have unmerged paths") {
			t.Error("Git state is not clean; merge --abort might have failed")
		}
	})
}
