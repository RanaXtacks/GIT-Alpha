# 🚀 GIT-Alpha — AI-Powered Project Health Dashboard

Welcome to **GIT-Alpha**, your real-time project health, complexity, and security scanner built directly into VS Code! 

This guide explains exactly **how to use it**, **what it requires**, and **how it works under the hood**.

---

## 📖 Table of Contents
1. [Prerequisites & Conditions](#1-prerequisites--conditions)
2. [How to Install](#2-how-to-install)
3. [When & Where to Use It](#3-when--where-to-use-it)
4. [How to Open the Dashboard](#4-how-to-open-the-dashboard)
5. [How It Works (Features)](#5-how-it-works-features)
6. [Customizing Configuration](#6-customizing-configuration)

---

## 1. Prerequisites & Conditions

GIT-Alpha is designed to be lightweight, but it requires the following conditions to work correctly:

* **VS Code Version**: You must be running VS Code version `1.80.0` or higher.
* **Workspace Required**: You **must have a folder/project opened** in VS Code. If you just open VS Code without a folder (a blank window), the scanner cannot scan anything.
* **Internet Connection**: An internet connection is required for **two specific features**:
  * **Gemini AI Analysis**: To generate the AI summary.
  * **OSV.dev Vulnerability Scan**: To check your `package.json` against real-world CVE databases.
* **Gemini API Key**: The first time you use the AI feature, you will be prompted to enter a Google Gemini API Key. (You can get a free one at [Google AI Studio](https://aistudio.google.com/)).

---

## 2. How to Install

If you received the `.vsix` file from a friend or colleague, follow these steps:

**Method A (Fastest - UI)**
1. Open normal VS Code.
2. Click the **Extensions** icon on the left sidebar (the 4 squares).
3. Click the `...` (three dots) at the top right of the Extensions menu.
4. Click **Install from VSIX...** and select the `git-alpha-0.0.5.vsix` file.

**Method B (Terminal)**
1. Open a terminal.
2. Run this command pointing to the file:
   `code --install-extension git-alpha-0.0.5.vsix`

*(Note: If you install it via Terminal, you MUST reload the VS Code window by pressing `F1` and typing `Developer: Reload Window` before it will appear).*

---

## 3. When & Where to Use It

**Where to open it:**
You should open GIT-Alpha in the root directory of your project (the main folder containing your code). 

**When to open it:**
* **Before a Code Review**: To ensure your code complexity isn't too high and no duplicate code exists.
* **Before a Release/Deployment**: To double-check for exposed API keys/secrets and CVE vulnerabilities in your dependencies.
* **When taking over a new codebase**: To instantly get a Gemini AI summary of what the project is, what it does, and its overall health.

---

## 4. How to Open the Dashboard

There are two ways to launch the GIT-Alpha dashboard:

### The Status Bar (The Easy Way)
Look at the bottom blue (or purple/grey) bar at the bottom of your VS Code window. On the right side, you will see a button that says:
👉 **`🛡️ GIT-Alpha: Ready`**
Click it, and the dashboard will instantly pop open!

### The Command Palette (The Pro Way)
1. Press **`F1`** (or `Ctrl+Shift+P` / `Cmd+Shift+P` on Mac).
2. Type **`GIT-Alpha`**.
3. Select **`GIT-Alpha: Open Dashboard`** from the list.

---

## 5. How It Works (Features)

Once the dashboard opens, it will scan your entire project in milliseconds. Here is what it looks for:

### ⚡ Lightning-Fast Workspace Scanner
GIT-Alpha bypasses standard slow Node.js `fs` calls by using high-speed globbing. It automatically ignores `node_modules`, `.git`, and `dist` folders so it doesn't waste time scanning built files.

### 🌳 True AST Complexity Analysis
Instead of just counting lines of code, GIT-Alpha parses the actual syntax tree (AST) of your JavaScript/TypeScript files. It calculates "cyclomatic complexity" by counting `if`, `for`, `while`, and `try/catch` statements to determine how hard your code is to read.

### 👯 Duplicate Code Detection (Jaccard Similarity)
Have you copy-pasted the same component three times? GIT-Alpha chops your code into "5-token shingles" and uses mathematical Jaccard Similarity to find files that share more than 70% of the exact same code structure.

### 🔐 High-Entropy Secret Detection
Never accidentally push a password to GitHub again! GIT-Alpha uses Shannon Entropy mathematical algorithms ($H(X) > 4.3$ bits/character) to detect randomly generated strings (like AWS Keys, JWT tokens, and database passwords) hidden inside your files.

### 🛡️ CVE Vulnerability Integration
It reads your `package.json` (and soon `requirements.txt`) and pings the global **OSV.dev** security database to see if any of the open-source libraries you are using have known security flaws (CVEs).

---

## 6. Customizing Configuration

If GIT-Alpha is scanning files you want it to ignore (like a custom `build` folder or `temp` directory), you can tell it to stop.

Create a file named exactly **`.healthdashboard.json`** in the root of your project, and add your ignore rules like this:

```json
{
  "ignore": [
    "**/build/**",
    "**/temp/**",
    "**/*.min.js"
  ]
}
```
GIT-Alpha will instantly respect these rules on the next scan!
