package common

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestGitSync(t *testing.T) {
	t.Setenv("GIT_AUTHOR_NAME", "Test User")
	t.Setenv("GIT_AUTHOR_EMAIL", "test@example.com")
	t.Setenv("GIT_COMMITTER_NAME", "Test User")
	t.Setenv("GIT_COMMITTER_EMAIL", "test@example.com")

	t.Run("Non-Git Directory", func(t *testing.T) {
		tempDir, _ := os.MkdirTemp("", "git-test-non-*")
		defer os.RemoveAll(tempDir)

		err := GitSync(tempDir, "")
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

		err := GitSync(tempDir, "")
		if err != nil {
			t.Errorf("Expected nil error for git dir without remote, got: %v", err)
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
		err := GitSync(localDir, "")
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
		err := GitSync(localDir, "")
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

	t.Run("Option A Backup, Clone, and Semantic App-Level Import Flow", func(t *testing.T) {
		ctx := context.Background()

		// 2. Create a bare remote repository
		remoteDir, _ := os.MkdirTemp("", "git-remote-opt-a-*")
		defer os.RemoveAll(remoteDir)
		_ = runGit(ctx, remoteDir, "init", "--bare")
		_ = runGit(ctx, remoteDir, "symbolic-ref", "HEAD", "refs/heads/main")

		// 3. Clone remote to a seed folder, write initial files, and push
		seedDir, _ := os.MkdirTemp("", "git-seed-opt-a-*")
		defer os.RemoveAll(seedDir)
		_ = runGit(ctx, seedDir, "clone", remoteDir, ".")

		remoteProjects := `[{"id": "remote-proj", "title": "Remote Project"}]`
		remoteBuckets := `[{"name": "remote-bucket", "title": "Remote Bucket"}]`
		_ = os.WriteFile(filepath.Join(seedDir, "projects.json"), []byte(remoteProjects), 0644)
		_ = os.WriteFile(filepath.Join(seedDir, "buckets.json"), []byte(remoteBuckets), 0644)
		_ = os.WriteFile(filepath.Join(seedDir, "remote_note.md"), []byte("remote note content"), 0644)

		_ = runGit(ctx, seedDir, "add", ".")
		_ = runGit(ctx, seedDir, "commit", "-m", "Seed remote repository")
		_ = runGit(ctx, seedDir, "push", "origin", "main")

		// 4. Create a non-Git local directory containing user files
		localDir, _ := os.MkdirTemp("", "git-local-opt-a-*")
		defer os.RemoveAll(localDir)

		localProjects := `[{"id": "local-proj", "title": "Local Project"}]`
		localBuckets := `[{"name": "local-bucket", "title": "Local Bucket"}]`
		_ = os.WriteFile(filepath.Join(localDir, "projects.json"), []byte(localProjects), 0644)
		_ = os.WriteFile(filepath.Join(localDir, "buckets.json"), []byte(localBuckets), 0644)
		_ = os.WriteFile(filepath.Join(localDir, "local_note.md"), []byte("local note content"), 0644)

		// 5. Run GitSync - this should trigger the Option A flow (backup, clone, and merge)
		err := GitSync(localDir, remoteDir)
		if err != nil {
			t.Fatalf("GitSync failed with Option A: %v", err)
		}

		// 6. Verify local directory is now a Git repository
		if _, err := os.Stat(filepath.Join(localDir, ".git")); os.IsNotExist(err) {
			t.Error("Expected local directory to be a Git repo, but .git is missing")
		}

		// 7. Verify semantic merge of projects.json
		projData, err := os.ReadFile(filepath.Join(localDir, "projects.json"))
		if err != nil {
			t.Fatalf("Failed to read merged projects.json: %v", err)
		}
		var mergedProjects []map[string]interface{}
		if err := json.Unmarshal(projData, &mergedProjects); err != nil {
			t.Fatalf("Failed to parse merged projects.json: %v", err)
		}
		if len(mergedProjects) != 2 {
			t.Errorf("Expected 2 projects in merged projects.json, got: %d (%s)", len(mergedProjects), string(projData))
		}

		// 8. Verify semantic merge of buckets.json
		bucketData, err := os.ReadFile(filepath.Join(localDir, "buckets.json"))
		if err != nil {
			t.Fatalf("Failed to read merged buckets.json: %v", err)
		}
		var mergedBuckets []map[string]interface{}
		if err := json.Unmarshal(bucketData, &mergedBuckets); err != nil {
			t.Fatalf("Failed to parse merged buckets.json: %v", err)
		}
		if len(mergedBuckets) != 2 {
			t.Errorf("Expected 2 buckets in merged buckets.json, got: %d (%s)", len(mergedBuckets), string(bucketData))
		}

		// 9. Verify notes co-exist side-by-side
		if _, err := os.Stat(filepath.Join(localDir, "remote_note.md")); os.IsNotExist(err) {
			t.Error("Expected remote_note.md to be imported, but it is missing")
		}
		if _, err := os.Stat(filepath.Join(localDir, "local_note.md")); os.IsNotExist(err) {
			t.Error("Expected local_note.md to be preserved, but it is missing")
		}
	})

	t.Run("Conflict-Free Rebase Sync Flow", func(t *testing.T) {
		// 1. Setup remote and local
		remoteDir, _ := os.MkdirTemp("", "git-rebase-remote-*")
		defer os.RemoveAll(remoteDir)
		ctx := context.Background()
		_ = runGit(ctx, remoteDir, "init", "--bare")
		_ = runGit(ctx, remoteDir, "symbolic-ref", "HEAD", "refs/heads/main")

		localDir, _ := os.MkdirTemp("", "git-rebase-local-*")
		defer os.RemoveAll(localDir)
		_ = runGit(ctx, localDir, "init")
		_ = runGit(ctx, localDir, "checkout", "-b", "main")
		_ = runGit(ctx, localDir, "remote", "add", "origin", remoteDir)
		_ = runGit(ctx, localDir, "config", "user.email", "test@example.com")
		_ = runGit(ctx, localDir, "config", "user.name", "Test User")

		// Initial setup
		_ = os.WriteFile(filepath.Join(localDir, "initial.md"), []byte("initial"), 0644)
		_ = runGit(ctx, localDir, "add", ".")
		_ = runGit(ctx, localDir, "commit", "-m", "Initial")
		_ = runGit(ctx, localDir, "push", "-u", "origin", "main")

		// 2. Create another local to simulate remote change
		otherDir, _ := os.MkdirTemp("", "git-rebase-other-*")
		defer os.RemoveAll(otherDir)
		_ = runGit(ctx, otherDir, "clone", remoteDir, ".")
		_ = runGit(ctx, otherDir, "config", "user.email", "test@example.com")
		_ = runGit(ctx, otherDir, "config", "user.name", "Test User")
		_ = os.WriteFile(filepath.Join(otherDir, "remote_only.md"), []byte("remote changes"), 0644)
		_ = runGit(ctx, otherDir, "add", ".")
		_ = runGit(ctx, otherDir, "commit", "-m", "Remote update")
		_ = runGit(ctx, otherDir, "push", "origin", "main")

		// 3. Edit distinct file in localDir to create a non-conflicting diverged history
		_ = os.WriteFile(filepath.Join(localDir, "local_only.md"), []byte("local changes"), 0644)

		// 4. Run GitSync - should automatically resolve conflict-free divergence using rebase/merge and succeed
		err := GitSync(localDir, "")
		if err != nil {
			t.Fatalf("Expected conflict-free sync to succeed, but got error: %v", err)
		}

		// 5. Verify local state has both changes
		if _, err := os.Stat(filepath.Join(localDir, "remote_only.md")); os.IsNotExist(err) {
			t.Error("Expected remote_only.md to exist in local repo after sync, but it is missing")
		}
		if _, err := os.Stat(filepath.Join(localDir, "local_only.md")); os.IsNotExist(err) {
			t.Error("Expected local_only.md to exist in local repo after sync, but it is missing")
		}

		// 6. Verify remote repo now has the local changes too
		verifyDir, _ := os.MkdirTemp("", "git-rebase-verify-*")
		defer os.RemoveAll(verifyDir)
		_ = runGit(ctx, verifyDir, "clone", remoteDir, ".")
		if _, err := os.Stat(filepath.Join(verifyDir, "local_only.md")); os.IsNotExist(err) {
			t.Error("Expected local changes to be pushed to remote repo after sync, but they are missing")
		}
	})
}

func TestExpandTilde(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to retrieve user home dir: %v", err)
	}

	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"/abs/path", "/abs/path"},
		{"~", home},
		{"~/my-repo.git", filepath.Join(home, "my-repo.git")},
		{"~\\my-repo.git", filepath.Join(home, "my-repo.git")},
	}

	for _, tt := range tests {
		got := expandTilde(tt.input)
		if got != tt.expected {
			t.Errorf("expandTilde(%q) = %q; expected %q", tt.input, got, tt.expected)
		}
	}
}

func TestGetRemoteURLFromConfig(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "git-config-test-*")
	defer os.RemoveAll(tempDir)

	gitDir := filepath.Join(tempDir, ".git")
	_ = os.MkdirAll(gitDir, 0755)

	t.Run("Missing config file", func(t *testing.T) {
		_, ok := getRemoteURLFromConfig(tempDir)
		if ok {
			t.Error("Expected getRemoteURLFromConfig to return false for missing config file")
		}
	})

	t.Run("Valid config file with origin", func(t *testing.T) {
		configContent := `[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = https://github.com/simon123h/jotter.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main`
		_ = os.WriteFile(filepath.Join(gitDir, "config"), []byte(configContent), 0644)

		url, ok := getRemoteURLFromConfig(tempDir)
		if !ok {
			t.Error("Expected getRemoteURLFromConfig to return true for valid config")
		}
		expectedURL := "https://github.com/simon123h/jotter.git"
		if url != expectedURL {
			t.Errorf("Expected URL %q, got: %q", expectedURL, url)
		}
	})
}

func TestGetCurrentBranchFromConfig(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "git-head-test-*")
	defer os.RemoveAll(tempDir)

	gitDir := filepath.Join(tempDir, ".git")
	_ = os.MkdirAll(gitDir, 0755)

	t.Run("Missing HEAD file", func(t *testing.T) {
		_, ok := getCurrentBranchFromConfig(tempDir)
		if ok {
			t.Error("Expected getCurrentBranchFromConfig to return false for missing HEAD file")
		}
	})

	t.Run("Valid branch ref in HEAD", func(t *testing.T) {
		_ = os.WriteFile(filepath.Join(gitDir, "HEAD"), []byte("ref: refs/heads/feature/rebase-sync\n"), 0644)

		branch, ok := getCurrentBranchFromConfig(tempDir)
		if !ok {
			t.Error("Expected getCurrentBranchFromConfig to return true for valid HEAD ref")
		}
		expectedBranch := "feature/rebase-sync"
		if branch != expectedBranch {
			t.Errorf("Expected branch %q, got: %q", expectedBranch, branch)
		}
	})

	t.Run("Detached HEAD", func(t *testing.T) {
		_ = os.WriteFile(filepath.Join(gitDir, "HEAD"), []byte("2d628f804ae889c2bc54a0136d8f8a1562916b9b\n"), 0644)

		_, ok := getCurrentBranchFromConfig(tempDir)
		if ok {
			t.Error("Expected getCurrentBranchFromConfig to return false for detached HEAD")
		}
	})
}
