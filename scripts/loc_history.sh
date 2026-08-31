#!/usr/bin/env bash
set -euo pipefail

# Store the current branch/commit to restore it later
current_ref=$(git symbolic-ref --short -q HEAD || git rev-parse HEAD)

# Cleanup trap to ensure we restore the original state even if the script is interrupted
cleanup() {
    echo "Restoring repository to $current_ref..."
    git checkout -q "$current_ref"
}
trap cleanup EXIT

output_file="loc_history.txt"
echo "Date,Commit,Backend_LOC,TS_Vue_CSS_LOC,Total_LOC" > "$output_file"

echo "Calculating LOC history..."

# Get all commits in chronological order
commits=$(git log --reverse --pretty=format:"%H|%ad" --date=short)

count_lines() {
    local pattern=$1
    local files
    files=$(find . -type f -name "$pattern" \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" \
        -not -path "*/.git/*" \
        -not -path "*/.github/*" \
        -not -name "*.d.ts" 2>/dev/null)
    
    if [ -z "$files" ]; then
        echo 0
        return
    fi
    
    # Run wc -l and get the total line count
    echo "$files" | xargs wc -l 2>/dev/null | tail -n 1 | awk '{print $1}'
}

while IFS='|' read -r commit date; do
    echo "Processing commit ${commit:0:7} ($date)..."
    git checkout -q "$commit"
    
    # Count Backend lines
    backend_loc=0
    for ext in "*.go" "*.py"; do
        ext_loc=$(count_lines "$ext")
        if [[ "$ext_loc" =~ ^[0-9]+$ ]]; then
            backend_loc=$((backend_loc + ext_loc))
        fi
    done

    # Count Frontend lines (TS, Vue, CSS)
    ts_vue_css_loc=0
    for ext in "*.ts" "*.vue" "*.css"; do
        ext_loc=$(count_lines "$ext")
        if [[ "$ext_loc" =~ ^[0-9]+$ ]]; then
            ts_vue_css_loc=$((ts_vue_css_loc + ext_loc))
        fi
    done
    
    total_loc=$((backend_loc + ts_vue_css_loc))
    
    echo "$date,${commit:0:7},$backend_loc,$ts_vue_css_loc,$total_loc" >> "$output_file"
done <<< "$commits"

echo "Done! LOC history written to $output_file"
