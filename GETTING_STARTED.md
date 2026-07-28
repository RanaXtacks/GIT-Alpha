# 🚀 GIT-Alpha!! — Beginner's Script & Quickstart Guide

Welcome to **GIT-Alpha!!** — Your real-time project health dashboard & AI code assistant in VS Code!

Whether you are a student, junior developer, or experienced engineer, this guide will walk you through everything step-by-step in plain, simple language.

---

## 🎬 3-Minute Quickstart Script

Follow these 4 simple steps to start using GIT-Alpha right now!

### Step 1: Open the Extension
1. Open any project folder in **VS Code** or **Antigravity IDE**.
2. Look at the bottom-right corner of your screen (the Status Bar).
3. You will see a live badge: **`🛡️ GIT-Alpha: Low Effort | 0 Risks`**.
4. **Click it!** (Or press `Ctrl+Shift+P` / `Cmd+Shift+P`, type **`GIT-Alpha: Open Dashboard`**, and press Enter).

---

### Step 2: Set Up the Gemini AI Brain (One-Time Setup)
1. Inside the dashboard, click on the **"Errored Files"** tab.
2. Click the **"🧠 Ask Brain to Fix"** button on any file.
3. A popup will ask for your **Gemini API Key**.
4. Get a free key from [Google AI Studio](https://aistudio.google.com/apikey).
5. Paste it and press **Enter**.
6. *That's it!* Gemini will analyze your broken code and generate an instant fix suggestion right on your screen.

---

### Step 3: Connect Your GitHub Account (Optional)
Want to see your repo's stars, forks, and open issues in the header?
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`.
2. Type **`GIT-Alpha: Login to GitHub`** and press Enter.
3. Click **"Allow"** when VS Code asks to authorize.
4. Your GitHub repository stats will now display at the top-right of your dashboard!

---

### Step 4: Work as Usual — Real-Time Background Auditing!
- You don't need to manually click "Scan".
- Every time you save a file (`Ctrl+S`), GIT-Alpha automatically rescans your workspace in the background and updates the Status Bar & Dashboard in real-time!

---

## 🧭 Dashboard Navigation for Beginners

Here is what each section of the dashboard tells you:

| Tab / Card | What It Does | What You Should Do |
|---|---|---|
| 📄 **Code Files Scanned** | Counts actual source files (`.ts`, `.js`, `.py`, etc.) scanned in your project. | Verify your code files are being detected cleanly. |
| 🚨 **Errored Files** | Lists files with syntax or compiler errors. | Click the file name to open it in VS Code, or click **"🧠 Ask Brain to Fix"** for AI solutions. |
| 👯 **Duplicate Code Pairs** | Finds files sharing >75% identical logic. | Combine repeated code into shared helper functions to keep your project clean. |
| 🔐 **Security Risks** | Detects hardcoded API keys, tokens, or passwords ($H(X) > 4.8$ bits/char). | Move secrets into a `.env` file! Never commit raw passwords to GitHub. |
| 🛡️ **CVE Vulnerabilities** | Checks `package.json` / `requirements.txt` against open OSV.dev vulnerability database. | Run `npm audit fix` or update outdated package versions. |
| 📈 **Project Effort Tier** | Gives your project a overall health grade: **Low**, **Medium**, or **High** effort to maintain. | Aim for **Low Effort** by fixing errors, removing duplicate code, and securing API keys! |

---

## ❓ Frequently Asked Questions (FAQ)

### 1. Is my code sent to any third-party servers?
**No.** Workspace scanning, entropy calculations, and duplicate checks run **100% locally on your computer**. The only time external requests occur:
- **Gemini AI Brain**: Only sends the specific file content when you explicitly click *"Ask Brain to Fix"*.
- **OSV.dev Vulnerability Check**: Sends package names/versions to query known CVE security flaws.

### 2. How do I change my Gemini API Key?
Press `Ctrl+Shift+P` → Type **`GIT-Alpha: Set Gemini API Key`** → Paste your new key.

### 3. What if I install from a `.vsix` file?
1. Download `git-alpha-0.0.1.vsix`.
2. Open VS Code → Go to Extensions (`Ctrl+Shift+X`).
3. Click the `...` (three dots) menu in the top-right of the Extensions panel.
4. Click **"Install from VSIX..."** and select the `.vsix` file.

---

*Made with ❤️ by RanaXtacks — Happy Coding with GIT-Alpha!!*
