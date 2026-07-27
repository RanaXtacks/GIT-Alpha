# GIT-Alpha!! — Complete User Guide 🚀

A step-by-step guide to install, configure, and use GIT-Alpha from scratch.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [First Launch](#3-first-launch)
4. [GitHub Login — Why & What Happens](#4-github-login)
5. [Gemini AI Brain Setup](#5-gemini-ai-brain-setup)
6. [Understanding the Dashboard](#6-understanding-the-dashboard)
7. [Using the AI Brain to Fix Errors](#7-using-the-ai-brain)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Before using GIT-Alpha, ensure you have:
- **VS Code** (or Antigravity IDE) version 1.80+
- **Node.js** 18+ installed (`node -v` in terminal)
- A workspace/project folder open in VS Code
- (Optional) A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey) — free tier available
- (Optional) A **GitHub account** for repo metadata features

---

## 2. Installation

### Option A: Install from Source (Development Mode)
```bash
# Clone the repository
git clone https://github.com/RanaXtacks/GIT-Alpha.git
cd GIT-Alpha

# Install dependencies
npm install

# Build the React dashboard UI
cd webview-ui
npm install
npm run build

# Go back and compile the extension backend
cd ..
npm run compile
```

### Option B: Install from .vsix (Production Bundle)
```bash
# Package the extension
npm run package

# This creates git-alpha-0.0.1.vsix
# In VS Code: Extensions → ⋯ menu → "Install from VSIX..." → select the file
```

---

## 3. First Launch

1. Open any project/workspace folder in VS Code
2. Press `Ctrl+Shift+P` (Command Palette)
3. Type **`GIT-Alpha: Open Dashboard`** and press Enter
4. The GIT-Alpha!! dashboard will open as a new tab!

**What happens immediately:**
- GIT-Alpha scans **every file** in your workspace
- Counts total files, errored files, complexity blocks
- Detects hardcoded secrets and API keys
- Checks your dependencies for known vulnerabilities
- Calculates a Project Effort Tier (Low / Medium / High)

**Auto-rescan:** Every time you save a file (`Ctrl+S`), GIT-Alpha automatically rescans the workspace and updates the dashboard in real-time!

---

## 4. GitHub Login — Why & What Happens

### How to Login
1. Press `Ctrl+Shift+P` → Type **`GIT-Alpha: Login to GitHub`**
2. VS Code will show a popup asking you to authorize with your GitHub account
3. Click **"Allow"** — this uses VS Code's built-in secure OAuth flow (the same one GitHub Copilot uses)

### Why Login?
When you log in, GIT-Alpha uses the GitHub REST API to pull **repository metadata** for your project:

| Data Pulled | What It Means |
|---|---|
| ⭐ **Stars** | How many people starred your repo |
| 🍴 **Forks** | How many people forked your repo |
| 🐛 **Open Issues** | Number of unresolved issues on GitHub |
| 📝 **Last Commit** | Date and message of the most recent commit |

This data appears in the **top-right corner** of your GIT-Alpha!! dashboard header.

### Is it safe?
- Your GitHub token is **never stored in a file**
- It uses VS Code's built-in encrypted `SecretStorage`
- The token is only used to read public repo metadata (via the `repo` scope)
- You can revoke access anytime from GitHub Settings → Applications

### What if I don't login?
The dashboard works perfectly without GitHub login. You just won't see the repo stats widget in the header. All scanning, security, and AI features work independently.

---

## 5. Gemini AI Brain Setup

### Getting Your Free API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)

### Setting the Key in GIT-Alpha
**Method 1 — Automatic Prompt:**
- Click **"🧠 Ask Brain to Fix"** on any errored file
- If no key is stored, GIT-Alpha will automatically prompt you to enter it
- Paste your key and press Enter

**Method 2 — Manual Command:**
- Press `Ctrl+Shift+P` → Type **`GIT-Alpha: Set Gemini API Key`**
- Paste your key in the secure input box

### Where is the key stored?
- Stored in VS Code's **encrypted SecretStorage** (same vault as GitHub tokens)
- Never written to any file on disk
- Persists across sessions until you manually change it

### Is it free?
- Yes! Google offers a generous free tier for the Gemini API
- GIT-Alpha uses the lightweight `gemini-2.0-flash` model which is fast and cost-efficient

---

## 6. Understanding the Dashboard

### Overview Tab
| Card | What It Measures |
|---|---|
| **Total Files** | Every file in your workspace (excluding node_modules, .git, dist) |
| **Successfully Analyzed** | Files that parsed cleanly without any errors |
| **Errored Files** | Files with syntax errors or compiler errors detected by your IDE's language server |
| **Project Effort Tier** | Overall project health grade: **Low** (clean), **Medium** (some issues), **High** (needs attention) |
| **Complex AST Blocks** | Count of `if`, `for`, `while`, `try/catch` control-flow statements found by the Tree-sitter parser. High counts = spaghetti code |
| **Duplicate Code Pairs** | File pairs sharing >75% token similarity (copy-pasted code) |
| **Security Risks** | Hardcoded API keys, tokens, or passwords found via Shannon entropy analysis + pattern matching |

### Errored Files Tab
- Lists every file that has errors, showing the **exact error messages and line numbers**
- Click any file name to **open it directly in your editor**
- Click **"🧠 Ask Brain to Fix"** to get an AI-powered fix suggestion from Gemini

### Duplicates Tab
- Shows actual `fileA ↔ fileB` pairs that are near-duplicates
- Click either file name to open it in the editor
- Compare them side-by-side and refactor shared logic into helper functions

### Security Risks Tab
- **What it means:** Your source code contains hardcoded secrets (API keys, passwords, private keys)
- **Why the number is high:** The scanner uses Shannon entropy (mathematical randomness measure) to detect strings that "look like" raw tokens, plus pattern matching for known key formats (AWS `AKIA...`, GitHub `ghp_...`)
- **How to fix:** Move secrets to a `.env` file or use a secret manager

### Vulnerabilities Tab
- **What is a CVE?** A CVE (Common Vulnerabilities and Exposures) is a publicly disclosed security flaw in a third-party package
- **Where does the data come from?** GIT-Alpha queries the open [OSV.dev](https://osv.dev) database in real-time
- **How to fix:** Run `npm audit fix` or upgrade affected package versions

---

## 7. Using the AI Brain to Fix Errors

1. Open the **GIT-Alpha!! Dashboard**
2. Click the **"Errored Files"** tab (or scroll down on Overview)
3. Find the file you want to fix
4. Click **"🧠 Ask Brain to Fix"**
5. If this is your first time, enter your Gemini API key when prompted
6. Wait ~5-15 seconds for Gemini to analyze the file
7. The AI suggestion appears inline below the error listing!

The suggestion includes:
- What is wrong (in one sentence)
- How to fix it (with corrected code snippets)

---

## 8. Troubleshooting

### "Asking Gemini..." spinner never stops
- **Cause:** Network timeout or invalid API key
- **Fix:** After 30 seconds, an error message will appear. If it says "Invalid API key", run `Ctrl+Shift+P` → `GIT-Alpha: Set Gemini API Key` with a fresh key

### Dashboard shows 0 for everything
- Make sure you have a workspace folder open (not just a single file)
- Try saving any file (`Ctrl+S`) to trigger a rescan

### "Failed Files" not showing my errored file
- The file must be open in VS Code so the language server can detect errors
- Try opening the file in a tab, waiting 2-3 seconds, then saving it

### GitHub data not appearing
- Run `GIT-Alpha: Login to GitHub` first
- Your project must have a `.git/config` file with a GitHub remote URL

---

*Built with ❤️ by RanaXtacks — GIT-Alpha!!*
