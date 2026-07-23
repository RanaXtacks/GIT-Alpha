# GIT-Alpha Files Overview

Based on the architecture mapped out in the phase enhancements document, here is an overview of the most important files and folders needed for the GIT-Alpha extension. 

Because we are separating the "background brain" from the "user interface" (to keep things fast and secure), the project is broken down into four main folders, plus some configuration files at the root.

### 1. Root Configuration Files (The Blueprint)
*   **`package.json`**: The most important file in any VS Code extension. It defines all the tools we use, how the extension is launched (activation events), and tells VS Code what permissions we need.
*   **`.healthdashboard.json`**: The user-editable configuration file that will sit in a developer's project. It tells our scanner things like "what counts as a huge file" and "what folders to ignore."
*   **`.healthdashboard-baseline.json`**: A file to save "false alarms" from the security scanner, so users don't keep getting warned about a fake password in their test files.

### 2. `/extension` (The Background Brain)
This folder holds the code that talks directly to VS Code.
*   **`extension.ts`**: The main entry point. This is the first file that runs when the extension wakes up.
*   **`scanner.ts`**: The file that walks through the user's project, finds all the files to check, and listens for "file saved" events to rescan them.
*   **`github.ts`**: Handles the secure login to GitHub and talks to the GitHub API to fetch repo stats and check for insecure packages.

### 3. `/workers` (The Heavy Lifters)
To avoid freezing the user's editor, all the intense math and scanning happens in separate "worker" threads.
*   **`parser.ts`**: Uses the `Tree-sitter` tool to read and understand the Python, JavaScript, and TypeScript code.
*   **`analyzer.ts`**: Does the actual detective work. It calculates code complexity, runs the `MinHash` algorithm to find duplicate code, and checks string entropy to find leaked passwords.

### 4. `/webview` (The User Interface)
This is essentially a mini website (built with React) that lives inside a VS Code tab.
*   **`index.tsx`** (and other React components): The visual dashboard itself. It takes the data from the scanner and turns it into the clean grids, charts, and "Low/Medium/High" effort tiers that the user sees.

### 5. `/shared` (The Bridge)
*   **`messages.ts`**: Since the `/extension` (Brain) and the `/webview` (Interface) are completely separate, they have to send messages to each other. This file contains the strict rules (TypeScript types) defining exactly what data they are allowed to send back and forth, so nothing crashes.

### 6. Testing & CI
*   **`/tests/golden-files/`**: Sample code files and their expected scan results. If we change how the scanner works, these files make sure we didn't accidentally break the math.
*   **`.github/workflows/ci.yml`**: The automated pipeline that blocks us from releasing a broken version of the extension by running all our tests in the cloud.
