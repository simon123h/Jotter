const fs = require('fs');
const path = require('path');

try {
  // Read Backend Coverage
  const backendCovPath = path.join(__dirname, '../backend/coverage.json');
  let backendTotal = 0;
  let backendCovered = 0;
  let backendPct = 0;
  
  if (fs.existsSync(backendCovPath)) {
    const data = JSON.parse(fs.readFileSync(backendCovPath, 'utf8'));
    backendTotal = data.totals.num_statements || 0;
    backendCovered = data.totals.covered_lines || 0;
    backendPct = backendTotal > 0 ? (backendCovered / backendTotal) * 100 : 0;
  }

  // Read Frontend Coverage
  const frontendCovPath = path.join(__dirname, '../frontend/coverage/coverage-summary.json');
  let frontendTotal = 0;
  let frontendCovered = 0;
  let frontendPct = 0;

  if (fs.existsSync(frontendCovPath)) {
    const data = JSON.parse(fs.readFileSync(frontendCovPath, 'utf8'));
    frontendTotal = data.total.statements.total || 0;
    frontendCovered = data.total.statements.covered || 0;
    frontendPct = data.total.statements.pct || 0;
  }

  // Compute Overall Combined
  const combinedTotal = backendTotal + frontendTotal;
  const combinedCovered = backendCovered + frontendCovered;
  const combinedPct = combinedTotal > 0 ? (combinedCovered / combinedTotal) * 100 : 0;

  // Generate Markdown
  const markdown = `
### 📊 Code Coverage Summary

| Suite | Covered Statements | Total Statements | Coverage % |
| :--- | :---: | :---: | :---: |
| **Backend (Python)** | ${backendCovered} | ${backendTotal} | **${backendPct.toFixed(2)}%** |
| **Frontend (Vitest)** | ${frontendCovered} | ${frontendTotal} | **${frontendPct.toFixed(2)}%** |
| **Overall Combined** | ${combinedCovered} | ${combinedTotal} | **${combinedPct.toFixed(2)}%** |

`;

  console.log(markdown);

  // Write to GitHub Step Summary if running in GitHub Actions
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, markdown);
    console.log(`Successfully wrote coverage report to $GITHUB_STEP_SUMMARY`);
  }
} catch (error) {
  console.error('Error combining coverage reports:', error);
  process.exit(1);
}
