package common

import (
	"context"
	"encoding/json"
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

	remoteURL = expandTilde(remoteURL)

	// 2. Check if it's already a git repo
	isGit := true
	if _, err := os.Stat(filepath.Join(projectDir, ".git")); os.IsNotExist(err) {
		isGit = false
	}

	if !isGit && remoteURL != "" {
		// Detect if remote actually has commits first
		hasRemoteCommits := false
		cmdRemote := exec.CommandContext(ctx, "git", "ls-remote", "--heads", remoteURL)
		prepareCmd(cmdRemote)
		if out, err := cmdRemote.Output(); err == nil && len(strings.TrimSpace(string(out))) > 0 {
			hasRemoteCommits = true
		}

		if hasRemoteCommits {
			// Check if local directory has any user files (not empty)
			hasLocalFiles := false
			entries, errRead := os.ReadDir(projectDir)
			if errRead == nil {
				for _, entry := range entries {
					name := entry.Name()
					if name != "." && name != ".." && name != ".git" && name != ".gitignore" {
						hasLocalFiles = true
						break
					}
				}
			}

			if !hasLocalFiles {
				// 1. Directory is empty: do a clean clone directly
				_ = os.RemoveAll(projectDir) // Remove empty directory so clone can run
				if errClone := runGit(ctx, filepath.Dir(projectDir), "clone", remoteURL, filepath.Base(projectDir)); errClone != nil {
					_ = os.MkdirAll(projectDir, 0755)
					return fmt.Errorf("git clone failed during sync init: %w", errClone)
				}
			} else {
				// 2. Directory has files: do the backup, clone, and merge strategy (Option A)
				backupDir := projectDir + "_backup_" + time.Now().Format("20060102150405")
				if errRename := os.Rename(projectDir, backupDir); errRename != nil {
					return fmt.Errorf("failed to create sync backup: %w", errRename)
				}

				if errClone := runGit(ctx, filepath.Dir(projectDir), "clone", remoteURL, filepath.Base(projectDir)); errClone != nil {
					// On clone failure, restore backup and return
					_ = os.Rename(backupDir, projectDir)
					return fmt.Errorf("git clone failed during sync init: %w", errClone)
				}

				// Merge the backup files into the newly cloned directory
				if errMerge := mergeDirs(backupDir, projectDir); errMerge != nil {
					return fmt.Errorf("failed to merge backup files: %w", errMerge)
				}

				// Clean up backup directory once successfully merged
				_ = os.RemoveAll(backupDir)
			}
		} else {
			// Remote is empty or uninitialized: run simple local init
			_ = runGit(ctx, projectDir, "init")
			_ = runGit(ctx, projectDir, "remote", "add", "origin", remoteURL)
		}
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
	prepareCmd(cmd)
	return cmd.Run() == nil
}

func getRemoteURL(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "remote", "get-url", "origin")
	cmd.Dir = dir
	prepareCmd(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func hasRemoteBranch(ctx context.Context, dir, branch string) bool {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--verify", branch)
	cmd.Dir = dir
	prepareCmd(cmd)
	return cmd.Run() == nil
}

func runGit(ctx context.Context, dir string, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	prepareCmd(cmd)
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
	prepareCmd(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "main", nil // Fallback
	}
	return string(out[:len(out)-1]), nil
}

// Merging two projects Helpers

func mergeDirs(src, dest string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		// Skip Git files
		if name == ".git" || name == ".gitignore" {
			continue
		}

		srcPath := filepath.Join(src, name)
		destPath := filepath.Join(dest, name)

		if entry.IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				return err
			}
			if err := mergeDirs(srcPath, destPath); err != nil {
				return err
			}
		} else {
			if name == "projects.json" {
				if _, err := os.Stat(destPath); err == nil {
					_ = mergeProjectsJSON(srcPath, destPath)
				} else {
					_ = copyFile(srcPath, destPath)
				}
			} else if name == "buckets.json" {
				if _, err := os.Stat(destPath); err == nil {
					_ = mergeBucketsJSON(srcPath, destPath)
				} else {
					_ = copyFile(srcPath, destPath)
				}
			} else {
				srcInfo, errStat := os.Stat(srcPath)
				if errStat != nil {
					continue
				}

				destInfo, errDest := os.Stat(destPath)
				if os.IsNotExist(errDest) {
					_ = copyFile(srcPath, destPath)
				} else if errDest == nil {
					if srcInfo.ModTime().After(destInfo.ModTime()) {
						_ = copyFile(srcPath, destPath)
					}
				}
			}
		}
	}
	return nil
}

func copyFile(src, dest string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dest, input, 0644)
}

func mergeProjectsJSON(localPath, remotePath string) error {
	localData, err := os.ReadFile(localPath)
	if err != nil {
		return err
	}
	var localProjects []map[string]interface{}
	if err := json.Unmarshal(localData, &localProjects); err != nil {
		return err
	}

	remoteData, err := os.ReadFile(remotePath)
	if err != nil {
		return err
	}
	var remoteProjects []map[string]interface{}
	if err := json.Unmarshal(remoteData, &remoteProjects); err != nil {
		return err
	}

	mergedMap := make(map[string]map[string]interface{})
	for _, p := range remoteProjects {
		if id, ok := p["id"].(string); ok {
			mergedMap[id] = p
		}
	}

	for _, p := range localProjects {
		if id, ok := p["id"].(string); ok {
			if existing, found := mergedMap[id]; found {
				for k, v := range p {
					if existing[k] == nil {
						existing[k] = v
					}
				}
			} else {
				mergedMap[id] = p
			}
		}
	}

	var mergedList []map[string]interface{}
	for _, p := range mergedMap {
		mergedList = append(mergedList, p)
	}

	mergedData, err := json.MarshalIndent(mergedList, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(remotePath, mergedData, 0644)
}

func mergeBucketsJSON(localPath, remotePath string) error {
	localData, err := os.ReadFile(localPath)
	if err != nil {
		return err
	}
	var localBuckets []map[string]interface{}
	if err := json.Unmarshal(localData, &localBuckets); err != nil {
		return err
	}

	remoteData, err := os.ReadFile(remotePath)
	if err != nil {
		return err
	}
	var remoteBuckets []map[string]interface{}
	if err := json.Unmarshal(remoteData, &remoteBuckets); err != nil {
		return err
	}

	mergedMap := make(map[string]map[string]interface{})
	for _, b := range remoteBuckets {
		if name, ok := b["name"].(string); ok {
			mergedMap[name] = b
		}
	}

	for _, b := range localBuckets {
		if name, ok := b["name"].(string); ok {
			if existing, found := mergedMap[name]; found {
				for k, v := range b {
					if existing[k] == nil {
						existing[k] = v
					}
				}
			} else {
				mergedMap[name] = b
			}
		}
	}

	var mergedList []map[string]interface{}
	for _, b := range mergedMap {
		mergedList = append(mergedList, b)
	}

	mergedData, err := json.MarshalIndent(mergedList, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(remotePath, mergedData, 0644)
}

func expandTilde(path string) string {
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err == nil {
			if path == "~" {
				return home
			}
			if strings.HasPrefix(path, "~/") || strings.HasPrefix(path, "~\\") {
				return filepath.Join(home, path[2:])
			}
		}
	}
	return path
}
