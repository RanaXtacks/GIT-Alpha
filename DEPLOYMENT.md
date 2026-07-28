# 🚢 GIT-Alpha!! — Complete Deployment Guide

Step-by-step from zero to deployed worldwide — **no Azure or Microsoft account required**.

---

## 🗺️ Overview — 3 Ways to Deploy

| Method | Who It's For | Needs Azure? | Difficulty |
|---|---|---|---|
| **A. Local `.vsix`** | Your own machine or team | ❌ No | ⭐ Easy |
| **B. GitHub Releases** | Public worldwide download link | ❌ No | ⭐⭐ Medium |
| **C. Open VSX Registry** | Works in VS Code, VSCodium, Gitpod & more | ❌ No | ⭐⭐ Medium |

> **Why not the official VS Code Marketplace?**
> Microsoft's Marketplace requires an Azure DevOps account + PAT token — which many users find blocked, slow, or frustrating to set up. **Open VSX** is the open-source equivalent hosted by the Eclipse Foundation, and is fully accepted worldwide in VS Code, VSCodium, Gitpod, Eclipse Theia, and Coder.

---

## 🏗️ PART 1 — Build the Extension (Required for ALL Methods)

### 1.1 — Check Your Environment

Open a terminal and verify:

```bash
node -v       # Must be 18 or higher
npm -v        # Must be 9 or higher
git --version # Any version is fine
```

If Node is missing → download from [nodejs.org](https://nodejs.org)

---

### 1.2 — Install All Dependencies

```bash
# From your GIT-Alpha project root
npm install

cd webview-ui
npm install
cd ..
```

---

### 1.3 — Build the Webview UI

```bash
cd webview-ui
npm run build
cd ..
```

✅ Creates `webview-ui/build/` — the compiled React dashboard.

---

### 1.4 — Compile the Extension Backend

```bash
npm run compile
```

✅ Creates `dist/extension.js` — the compiled extension logic.

---

### 1.5 — Package into `.vsix`

```bash
npm run package
```

✅ Creates: **`git-alpha-0.0.1.vsix`** — your deployable extension file!

---

## 📦 PART 2 — Method A: Local / Team Installation (Easiest)

Share the `.vsix` file directly — no accounts needed at all.

### Install on your own machine:

```bash
code --install-extension git-alpha-0.0.1.vsix
```

### Install through VS Code UI:

1. Open VS Code → Extensions (`Ctrl+Shift+X`)
2. Click the **`···`** (three dots) menu top-right
3. Click **"Install from VSIX..."**
4. Select your `.vsix` file → Done! ✅

### Share with team:
Upload `git-alpha-0.0.1.vsix` to Google Drive / Discord / Email and tell your team to follow the same steps.

---

## 🐙 PART 3 — Method B: GitHub Release (Public Worldwide Download)

Makes your extension publicly downloadable from your GitHub repo. No stores, no accounts.

### Step 1: Commit and push your code

```bash
git add .
git commit -m "feat: release v0.0.1"
git push origin main
```

### Step 2: Create a GitHub Release

1. Open your GitHub repo → click **"Releases"** (right sidebar)
2. Click **"Create a new release"**
3. Fill in:
   - **Tag**: `v0.0.1`
   - **Title**: `GIT-Alpha!! v0.0.1 — First Release`
   - **Description**: List your features
4. Drag and drop `git-alpha-0.0.1.vsix` into the **"Attach binaries"** area
5. Click **"Publish release"** ✅

Anyone worldwide can now download your `.vsix` from:
`https://github.com/RanaXtacks/GIT-Alpha/releases`

And install it with:
```bash
code --install-extension git-alpha-0.0.1.vsix
```

---

## 🌍 PART 4 — Method C: Open VSX Registry (Best Worldwide Option)

[Open VSX](https://open-vsx.org) is the open-source VS Code extension registry by the Eclipse Foundation.

✅ No Microsoft account  
✅ No Azure DevOps  
✅ No PAT tokens  
✅ Works worldwide — VS Code, VSCodium, Gitpod, Coder, Eclipse Theia  
✅ Free forever  

---

### Step 1: Create an Open VSX Account

1. Go to [open-vsx.org](https://open-vsx.org)
2. Click **"Log in"** (top-right)
3. Click **"Log in with GitHub"** — that's it, no extra forms needed!

---

### Step 2: Generate an Access Token

1. Click your **profile picture** (top-right) → **"User Settings"**
2. Click **"Access Tokens"** in the left sidebar
3. Click **"Generate New Token"**
4. Name it `git-alpha-publish`
5. Click **"Generate"** → **Copy the token immediately** (won't show again!)

Save this token in a password manager.

---

### Step 3: Install `ovsx` CLI

```bash
npm install -g ovsx
```

---

### Step 4: Add Required Files

**A. Create `icon.png`** — a 128×128 pixel PNG logo in your project root.
*(Design one at [canva.com](https://canva.com) for free — download as 128×128 PNG)*

**B. Create `LICENSE`** file in your project root:
```
MIT License

Copyright (c) 2025 RanaXtacks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

**C. Update `package.json`** — add these fields:
```json
{
  "icon": "icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/RanaXtacks/GIT-Alpha"
  },
  "homepage": "https://github.com/RanaXtacks/GIT-Alpha#readme",
  "bugs": {
    "url": "https://github.com/RanaXtacks/GIT-Alpha/issues"
  },
  "keywords": ["security", "code quality", "dashboard", "AI", "gemini"],
  "categories": ["Other", "Linters"],
  "license": "MIT"
}
```

**D. Create `.vscodeignore`** in your project root (keeps bundle size small):
```
.vscode/**
.github/**
node_modules/**
webview-ui/node_modules/**
webview-ui/src/**
extension/**
shared/**
**/*.ts
**/*.map
.gitignore
tsconfig.json
```

---

### Step 5: Build + Package

```bash
cd webview-ui && npm run build && cd ..
npm run compile
npm run package
```

---

### Step 6: Publish to Open VSX

```bash
ovsx publish -p YOUR_TOKEN_HERE --packagePath git-alpha-0.0.1.vsix
```

Replace `YOUR_TOKEN_HERE` with the token from Step 2.

Expected output:
```
Publishing RanaXtacks.git-alpha 0.0.1...
Successfully published RanaXtacks.git-alpha 0.0.1
```

Your extension is now live at:
`https://open-vsx.org/extension/RanaXtacks/git-alpha`

---

### Step 7: How Users Install It

**Search in VS Code:**
1. Press `Ctrl+Shift+X` → search **"GIT-Alpha"** → Click Install

**Direct install command** (share this link anywhere):
```bash
code --install-extension RanaXtacks.git-alpha
```

**Download from website:**
1. Visit `https://open-vsx.org/extension/RanaXtacks/git-alpha`
2. Click **"Download"** to get the `.vsix`
3. `code --install-extension git-alpha-0.0.1.vsix`

---

## 🔄 PART 5 — Publishing Future Updates

For every new version:

```bash
# 1. Bump version in package.json  (e.g. "0.0.1" → "0.0.2")

# 2. Rebuild everything
cd webview-ui && npm run build && cd ..
npm run compile
npm run package

# 3. Publish to Open VSX
ovsx publish -p YOUR_TOKEN_HERE --packagePath git-alpha-0.0.2.vsix

# 4. Create a new GitHub Release + attach the new .vsix
git tag v0.0.2
git push origin v0.0.2
```

---

## ✅ Pre-Deploy Checklist

- [ ] `npm run compile` — no TypeScript errors
- [ ] `cd webview-ui && npm run build` — fresh `build/` folder created
- [ ] `package.json` has correct `publisher`, `version`, `description`
- [ ] `icon.png` exists (128×128 px) in project root
- [ ] `LICENSE` file exists in project root
- [ ] `.vscodeignore` configured to exclude `node_modules`, `*.ts`, etc.
- [ ] `README.md` updated with latest features
- [ ] Tested `.vsix` locally before publishing

---

## 📊 Quick Command Reference

```bash
# ── Build ──────────────────────────────────────────
cd webview-ui && npm run build && cd ..
npm run compile

# ── Package ────────────────────────────────────────
npm run package                        # → git-alpha-0.0.1.vsix

# ── Test Locally ───────────────────────────────────
code --install-extension git-alpha-0.0.1.vsix

# ── Open VSX (worldwide, no Azure) ─────────────────
npm install -g ovsx
ovsx publish -p YOUR_TOKEN --packagePath git-alpha-0.0.1.vsix

# ── GitHub Release ──────────────────────────────────
git tag v0.0.1
git push origin v0.0.1
# → Then create Release on GitHub and attach .vsix
```
