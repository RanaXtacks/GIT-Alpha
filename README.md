# GIT-Alpha — Project Health Dashboard

GIT-Alpha is a high-performance, real-time Project Health & Security Dashboard for VS Code.

## Features

- ⚡ **Workspace Scanner**: Fast multi-file scanning with low CPU overhead.
- 🌳 **AST Complexity Analysis**: Uses Tree-sitter parsers to calculate true code complexity (counting `if`, `for`, `while`, and `try/catch` control flow blocks).
- 👯 **Duplicate Code Detection**: Uses 5-token shingle Jaccard similarity to detect near-duplicate code files.
- 🔐 **High-Entropy Secret Detection**: Scans workspace files for exposed AWS keys, GitHub PATs, and high-entropy secret strings ($H(X) > 4.3$ bits/char).
- 🛡️ **CVE Vulnerability Checking**: Real-time integration with OSV.dev database to check package dependencies (`package.json`, `requirements.txt`) for security vulnerabilities.
- 📊 **Effort Tier Grading**: Automatically grades project effort as **Low**, **Medium**, or **High**.

## Commands

- `GIT-Alpha: Open Dashboard` — Launches the real-time React dashboard.
- `GIT-Alpha: Login to GitHub` — Authenticates with GitHub using VS Code's native auth provider.

## Extension Settings

Create a `.healthdashboard.json` in your workspace root to customize ignore patterns:
```json
{
  "ignore": [
    "**/build/**",
    "**/temp/**"
  ]
}
```
