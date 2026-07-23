# Phase Enhancement Plans — Project Health Dashboard

Companion to `project-health-dashboard-plan-v2.md`. That document said *what* each phase does and *why the phase exists*. This one goes one level down: for each phase, exactly what to build, the specific tool/API/command to build it with, and why that specific choice beats the obvious alternative. A few of these are genuine corrections to the v2 plan — going granular surfaced better answers than the phase-level version had.

---

## Phase 0 — Architecture decision

**What to do**
- Resolve desktop-only vs. web-extension target before anything else — it forks several later decisions.
- Set up the repo structure with a hard boundary between extension-host code and webview code.
- Write a one-page ADR recording the decision and the trigger condition for revisiting it.

**How**
Repo layout:
```
/extension   — Node extension host: activation, commands, providers
/webview     — React dashboard UI, bundled separately, browser target
/shared      — TypeScript types shared between host and webview
/workers     — worker_thread scripts: parser, analyzers
```
Bundler: esbuild for the extension host (matches what Microsoft's own extension samples use — sub-second rebuilds matter across a 6-phase build), a separate esbuild/vite config for the webview since it needs a browser build target, not a Node one.

The fork, made concrete:

| Concern | Desktop extension (Node host) | Web extension (vscode.dev / github.dev) |
|---|---|---|
| Tree-sitter | Native bindings (`tree-sitter`, `tree-sitter-python`, …) — fast | `web-tree-sitter` (WASM) — ~2–3x slower parse, but portable |
| Cache layer | `better-sqlite3` (native, synchronous, fast) | Not available — needs `sql.js` (WASM) or `ExtensionContext.globalState`/IndexedDB |
| Worker model | Node `worker_threads` | Web Workers (different API, different message-passing) |
| File access | Node `fs` module directly | Must go through `vscode.workspace.fs` (virtual FS API) |
| GitHub auth | `vscode.authentication` | same — works in both |

**Why**
Splitting host/webview/workers with an explicit boundary heads off the single most common VS Code extension build failure: accidentally importing Node-only code into the webview bundle, which runs in a sandboxed browser-like context with no Node APIs. Better to design the boundary in Phase 0 than discover the break in Phase 2.

Recommendation: desktop-only for the alpha. Narrower surface, ships faster, and the WASM swap later (if web-extension support becomes a real ask) is mechanical — same parser queries, same analysis logic, different bindings underneath. Building the WASM path speculatively before anyone asks for it is exactly the kind of unforced complexity this whole revision has been cutting elsewhere.

---

## Phase 1 — Security & permissions

**What to do**
- Scope `activationEvents` and permissions tightly in `package.json`.
- Wrap GitHub credential handling in `secretStorage`.
- Authenticate via VS Code's built-in GitHub provider rather than a hand-rolled flow.
- Add a sanitization pass ahead of any metric that doesn't need string/comment content.

**How**
Activation: avoid `"activationEvents": ["*"]` — it activates on every VS Code startup and is explicitly discouraged in Microsoft's own extension guidelines because of the startup-time cost. Use a command- or view-based activation event instead, so the extension loads on first use, not on every VS Code launch.

Secret storage:
```ts
const token = await context.secrets.get('github.pat');
await context.secrets.store('github.pat', newToken);
context.secrets.onDidChange(handleExternalChange); // e.g. revocation
```

Auth — the actual correction to the v2 plan: don't implement OAuth device flow by hand. VS Code ships a built-in GitHub authentication provider:
```ts
const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
```
This removes an entire category of "did I implement the OAuth flow correctly" security review, and it's what the session token, refresh, and revocation handling already goes through inside VS Code itself.

Sanitization: once Phase 3's Tree-sitter integration exists, strip string/comment node ranges directly from the parse tree rather than maintaining a second regex-based "understand this language" pass. Line-count-only metrics in Phase 2 don't need this yet, so it's fine for sanitization to land slightly after the parser, not before it.

**Why**
The `vscode.authentication` API is a strictly better answer than "OAuth device flow, PAT as fallback" from the v2 plan — same outcome (no plaintext PAT paste-in required), materially less code to get wrong, and it's the API VS Code's own GitHub Pull Requests and Git extensions use internally, so it's a well-trodden path rather than a novel integration.

---

## Phase 2 — MVP scanning engine

**What to do**
- Traverse the workspace respecting `.gitignore`.
- Trigger incremental re-scans on save, debounced — not on every keystroke.
- Validate the project config file instead of trusting it.
- Stand up the webview with a typed message contract.
- Isolate per-file failures so one bad file can't kill a scan.

**How**
Traversal: `fast-glob` + the `ignore` npm package. Don't hand-roll `.gitignore` parsing — negation patterns and directory-only patterns have real edge cases that a from-scratch implementation reliably gets wrong on the first pass.

Debounce trigger: `vscode.workspace.onDidSaveTextDocument`, not `onDidChangeTextDocument`. The latter fires on every keystroke — far too frequent for a full analysis pass. Save-triggered is the right granularity for an alpha; live-as-you-type analysis is a materially harder problem (true streaming incremental re-analysis) and isn't worth the complexity yet. Worth stating as an explicit scope decision rather than leaving it ambiguous.

Config validation: `zod` schema matching `.healthdashboard.json`, parsed with `.safeParse()` so a malformed config degrades to defaults with a surfaced warning instead of crashing extension activation.

Webview: `vscode.window.createWebviewPanel({ enableScripts: true, ... })` with a strict, nonce-based `Content-Security-Policy` — this is the actual security boundary around a webview that's rendering React and receiving scan data, not an optional hardening step.

Message contract — a discriminated union in `/shared`, typed on both ends instead of stringly-typed JSON guessed at on each side:
```ts
type HostMessage =
  | { type: 'scanComplete'; payload: ScanResult }
  | { type: 'scanFailed'; payload: { fileCount: number; failedCount: number } };
type WebviewMessage =
  | { type: 'requestRescan' }
  | { type: 'openFile'; path: string };
```

Per-file isolation:
```ts
const results = await Promise.allSettled(files.map(analyzeFile));
const failures = results.filter(r => r.status === 'rejected');
```

**Why**
`Promise.allSettled` over `Promise.all` is the specific mechanism behind "one bad file doesn't kill the scan" — `Promise.all` rejects the whole batch on a single failure, which is exactly the failure mode the v2 plan's "error boundary" language was gesturing at without naming an implementation. This closes that gap concretely.

---

## Phase 3 — Deep code intelligence

**What to do**
- Integrate Tree-sitter grammars for Python, JS, TS.
- Detect complexity via parser queries, not hand-walked trees.
- Detect near-duplicates via MinHash + LSH, with named parameters.
- Replace the effort formula with explicit, tunable tier rules.

**How**
Packages: `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript` — native bindings, consistent with the desktop-only decision from Phase 0.

Complexity: Tree-sitter's own query language (`.scm` files, S-expression syntax) matching `if_statement` / `for_statement` / `while_statement` / `try_statement` nodes, with nesting depth computed via ancestor traversal. This keeps "what counts as complex" in a reviewable, diffable query file instead of buried inside imperative control flow — which matters once you're tuning thresholds against real dogfooding feedback in Phase 6.

Duplicate detection, with the actual tunable parameters named rather than left abstract:
- Shingle each function/block into k-token windows, k≈5
- Hash each shingle, keep the per-block minimum-hash signature (MinHash)
- Bucket similar signatures via LSH banding — e.g. 20 bands × 5 hashes per band
- Run exact comparison only within a matched bucket

The `minhash` npm package implements this, or the datasketch algorithm ports cleanly in ~80 lines if you'd rather avoid the extra dependency.

Effort tiers — the concrete replacement for the old formula, stated explicitly so it isn't just another vague promise:
- **Low**: 0 complex components and 0 security risks
- **Medium**: 1–5 complex components, or 1 security risk
- **High**: 6+ complex components, or 2+ security risks

**Why**
Naming the LSH banding parameters (20 × 5, specifically) rather than saying "MinHash + LSH" is the difference between a plan and something buildable — those numbers directly set the precision/recall tradeoff: more bands catches more near-duplicates at the cost of more false positives, fewer bands is faster but misses more. That's a real tuning decision, not an implementation detail to defer.

The three tier thresholds above are a starting point, not a final answer — same false-precision risk as the original formula if left untouched after Phase 6 dogfooding. Tune them against real usage; don't ship them as permanent on the strength of guesswork, same as the numbers they're replacing.

---

## Phase 4 — GitHub integration & security scanning

**What to do**
- Pull bulk repo metadata via GraphQL, not many REST calls.
- Cache conditionally with ETags to protect the rate-limit budget.
- Detect secrets with entropy plus regex, not either alone.
- Check dependencies against a real, maintained vulnerability database.

**How**
`@octokit/graphql` for a single bulk-metadata query per repo (commit frequency, branch protection, open PR count) instead of 4–5 separate REST round-trips.

ETag caching: store the response `ETag` alongside cached data; send `If-None-Match` on the next request; a `304` response means "use cache, zero rate-limit cost." This single change is the highest-leverage rate-limit optimization available for a multi-repo dashboard — without it, checking 20 repos every 10 minutes burns quota on metadata that usually hasn't changed at all.

Secret detection — three conditions together, not entropy alone:
```
entropy = -Σ p(char) · log2(p(char))   over the candidate string
```
Flag only when: entropy > ~4.0 bits/char, length > ~20 chars, **and** the string matches a base64/hex-like character set. Entropy alone still flags most UUIDs and hash outputs — the exact false-positive problem this change was meant to fix in the first place.

Dependency vulnerabilities: `POST https://api.osv.dev/v1/querybatch` with package name, ecosystem, and version pulled from `requirements.txt` / `package.json`. Free, no API key, actively maintained — no reason to hand-maintain a pattern list that will always lag real CVE data.

**Why**
A single new detection signal without corroborating conditions doesn't actually fix a false-positive problem — it just relocates it. Entropy-only secret detection is a strictly better false-positive rate than regex-only, but not by enough to be usable; the three-condition version is what actually gets adopted instead of muted after week one.

---

## Phase 5 — Reliability, testing & quality gates

**What to do**
- Golden-file tests for parser/metric output.
- A real VS Code integration test suite, separate from unit tests.
- A CI pipeline that blocks merges.
- Error handling as typed values, not thrown exceptions.

**How**
Golden files: for each language, a small set of representative source files plus a checked-in JSON snapshot of expected metric output. Any intentional change to metric calculation requires updating the golden file in the same PR — this is what makes silent metric drift visible in review instead of invisible in production.

Two separate test suites, not one: `vitest` for fast unit tests (ESM-native, good TS support), and `@vscode/test-electron` specifically for anything needing the real extension host — webview creation, command registration, `secretStorage`. Don't force host-dependent tests into a plain unit runner; they need the actual VS Code process.

CI skeleton (GitHub Actions):
```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: xvfb-run -a npm run test:integration
      - run: npm run package
```

Error handling: a `Result<T, E>` type — `{ ok: true, value: T } | { ok: false, error: E }` — returned from every analyzer stage instead of thrown exceptions, so failure is a value every caller must handle at compile time rather than an exception that might escape uncaught several call-levels up.

**Why**
`xvfb-run` is the single most common thing that breaks a first VS Code extension CI setup. `@vscode/test-electron` launches a real VS Code instance, which needs a display server even in headless CI. Skip this line and the integration test step fails on every Linux CI run with a cryptic display error that reads nothing like a test failure — worth naming explicitly rather than letting it be the thing that eats a debugging afternoon.

`Result` types are a stricter version of "error boundary" than a try/catch wrapper: the type system forces every caller to handle the failure case, where a try/catch three levels up the call stack is a runtime surprise no matter how many other boundaries exist elsewhere in the code.

---

## Phase 6 — Packaging, versioning & release

**What to do**
- Package and publish via `vsce`.
- Add a cheap, real feature-flag mechanism.
- Use the Marketplace's built-in pre-release channel.
- Track schema changes with explicit migrations.

**How**
`@vscode/vsce` for `vsce package` and `vsce publish` — publishing needs a Personal Access Token from **Azure DevOps**, not GitHub, which is easy to miss since everything else in this plan authenticates through GitHub.

Feature flags, sized to actual need: a JSON file fetched from a static URL (a GitHub Gist or Pages-hosted file), checked once at extension startup and cached for the session. Enough to disable `duplicateDetection` or `secretScanning` remotely without a full republish cycle. A full flag service (LaunchDarkly-style) is more machinery than an alpha needs.

Beta channel: `vsce publish --pre-release`; users opt in via "Switch to Pre-Release Version" in the Marketplace UI directly — no separate listing required.

Schema changes: keep a `CHANGELOG.md` in Keep-a-Changelog format; bump a schema-version constant whenever the SQLite cache shape changes, and gate a migration function on that version — even if the migration is "detect mismatch, wipe, rebuild" for the alpha. The part that matters now is detecting the mismatch, not yet preserving old cache data across versions.

**Why**
The Azure DevOps PAT requirement is a specific, non-obvious step that blocks publishing entirely if missed — worth naming rather than leaving "packaging" as a vague bullet that turns into a support-cycle surprise at release time.

The static-JSON flag file is intentionally the cheap version: the actual Phase 6 goal is "turn off a broken analyzer without a 24-hour Marketplace review cycle," not a general experimentation platform. Matching tool sophistication to what's actually needed right now is the same discipline Phase 0 applied to cutting the Python sidecar — don't build for a scale of problem you don't have yet.
