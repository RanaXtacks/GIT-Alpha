# Project Health Dashboard — Revised Implementation Plan (v2)

This revises the original alpha roadmap. It keeps what was sound (security-first, phased build-out, local-first processing) and fixes the parts that would break in a real repo: an unnecessary Python dependency, an unscaled duplicate-detection algorithm, a refactor-time formula with invented coefficients, and a testing strategy that only shows up in the last phase.

**Assumptions this plan makes** — flag if any are wrong, they change the design:
- Target platform is VS Code specifically (the original permissions list — `activeEditor`, `workspace.workspaceFolders`, `secretStorage` — are VS Code APIs, not generic extension concepts).
- Primary language scope is Python, JavaScript, and TypeScript, with room to add more via Tree-sitter grammars later.
- Single-repo, individual-developer usage first; multi-user/team sync is out of scope for alpha.

---

## Summary of changes

| Area | v1 approach | Problem | v2 approach | Why |
|---|---|---|---|---|
| Backend runtime | Python/FastAPI sidecar, assumed from Phase 0 | Requires bundling a Python runtime (~50–150MB) or requiring users to have Python installed — packaging and signing overhead for zero Phase-1 benefit | Node/TS end-to-end using `worker_threads`; Python only as an optional add-on if a later feature genuinely needs it | The extension already runs inside Node/Electron. Adding a second runtime is a decision to justify per-feature, not a default. |
| Parsing | Separate parsers per language (Python `ast`, Esprima/Babel for JS) | Doesn't scale past two languages; no incremental re-parse; each language is separately maintained | Tree-sitter (one incremental-parsing framework, ~40+ grammars) | Tree-sitter re-parses only the changed region of a file. That's the difference between "full workspace walk on every keystroke" and something that actually works on a 50k-line repo. |
| Duplicate detection | Token hashing / Levenshtein across all file pairs | O(n²) — a 5,000-file repo is ~12.5M pairwise comparisons | MinHash + LSH bucketing | Turns pairwise comparison into near-linear bucket lookups. Same technique used by jscpd and PMD-CPD at scale — not a novel choice, just a necessary one. |
| Refactor Hours formula | `(Complex×0.5) + (DeadFiles×0.1) + (SecurityRisks×1.5)` presented as hours | Coefficients aren't derived from anything; a confident wrong number is worse for trust than an honest vague one | Effort tiers (Low/Med/High) built from the same signals, shown alongside the raw counts; real coefficients only after collecting actual fix-time data | False precision invites a level of trust the tool hasn't earned yet. A tier is honest about what's actually known. |
| Secret scanning | Regex only | High false-positive rate — any 32-char hex string, UUID, or test fixture matches "looks like a key" | Regex + Shannon entropy scoring + a user-maintainable baseline/allowlist file | This is the same convergence point gitleaks and TruffleHog arrived at — pure regex alone is unusable in a real codebase within a week. |
| GitHub API | "Fetch repo metadata" with no failure handling | Authenticated REST/GraphQL is capped at 5,000 req/hr; a multi-repo dashboard burns through this fast | Exponential backoff, conditional requests (ETags), GraphQL for bulk metadata (1 request vs. many REST calls) | Difference between the extension quietly breaking after ~20 repos and working reliably at team scale. |
| Testing | Appears only in Phase 4, Step 1 ("Performance Optimization") | Untested AST-parsing and heuristic logic is exactly the code that silently produces wrong numbers, and you won't notice | Testing pyramid from Phase 1 onward: golden-file parser tests, `@vscode/test-electron` integration tests, CI on every PR | You can't retrofit trust in a tool whose entire value proposition is "trust these numbers." |
| Telemetry | Not mentioned | Without it, you can't tell if Phase 2/3 metrics are useful or noise — but "local-first" seems to rule it out | Opt-in, **default OFF**, metadata-only telemetry (counts, timings, error rates — never code or filenames) | Local-first protects code content. It doesn't require flying blind on whether the product works. These aren't actually in tension. |
| Release process | "Package for distribution" as the final step | No rollback path if a release corrupts the SQLite cache or crashes on scan | Beta channel, feature flags on risky analyzers, semver discipline | This is the real mechanism behind "doesn't fail on users" — not zero bugs, but bounded blast radius and a fast kill switch. |

---

## Phase 0: Architecture decision (new — resolve before writing code)

**Decide the runtime split before Phase 1, not during it.**

- Default: pure Node/TypeScript. `worker_threads` for CPU-bound parsing/analysis so the extension host UI thread never blocks.
- Only add a Python (or other) sidecar when a specific feature requires a library that doesn't exist in the Node ecosystem — e.g., a future ML-based similarity model. Each sidecar addition should be justified per-feature in a short ADR (architecture decision record), not assumed globally.
- If a sidecar is ever added: ship it as a separate optional download, not bundled into the base extension install.

---

## Phase 1: Security, privacy & permissions

Unchanged in principle from the original Phase 0, with specifics added:

- **Local-first analysis.** Process code inside the extension host or a local worker. Never transmit source code to third-party services without explicit, per-workspace opt-in — and that opt-in defaults to off.
- **Token management.** GitHub credentials via VS Code's `secretStorage` API. Prefer OAuth device-code flow over asking users to paste a PAT — fewer support tickets from scope mistakes, easier revocation.
- **Sanitization before analysis.** Strip comments/strings before computing metrics that don't need them (line counts, complexity) — reduces noise and incidental exposure of embedded secrets to the analysis layer itself.
- **Telemetry boundary, stated explicitly.** If telemetry ships at all: opt-in, default off, metadata only (event counts, duration, error codes). Never file names, file contents, or repo names. Document this in the extension's privacy notice, not just in code comments.
- **Least-privilege permissions manifest:**
  - `workspace.workspaceFolders` — read local repo structure
  - `secretStorage` — cache GitHub credentials
  - `net` (scoped to `api.github.com` and any telemetry endpoint) — outbound calls
  - No filesystem write access outside `.vscode/` and the extension's own storage directory

---

## Phase 2: MVP — core scanning engine

Goal unchanged: basic local scan with a webview panel. Implementation revised:

1. **Workspace traversal** — walk the tree respecting `.gitignore` (don't hand-roll ignore logic; use an existing ignore-parsing library), skip `.git`, `node_modules`, `venv`, `dist`.
2. **Incremental scanning, not full re-walks.** Use `vscode.workspace.onDidSaveTextDocument` / a file watcher with a debounce (e.g., 500ms) to re-scan only changed files, not the whole workspace, on every save. Full re-walk only on extension activation or explicit "rescan" command.
3. **Configurable thresholds, not magic numbers.** The "500-line huge file" and similar cutoffs go in a project-level config file (see example below), not hardcoded.
4. **Per-file error isolation.** A parse failure on one malformed file must not kill the scan. Wrap per-file analysis in try/catch, collect failures into a visible "N files skipped" indicator rather than crashing silently or crashing loudly.
5. **Dashboard UI** — React + Tailwind webview, dark-mode default, core metrics grid.

Example config schema (`.healthdashboard.json`, project root, user-editable):

```json
{
  "thresholds": {
    "hugeFileLines": 500,
    "maxNestingDepth": 4,
    "duplicateBlockMinLines": 15
  },
  "ignore": ["**/generated/**", "**/*.min.js"],
  "telemetry": { "enabled": false }
}
```

---

## Phase 3: Deep code intelligence & heuristics

1. **Parsing** — Tree-sitter, not per-language AST modules. One incremental-parsing layer across Python/JS/TS, extensible to more languages by adding a grammar, not writing a new parser integration.
2. **Complexity** — flag functions where nesting depth (if/for/while/try) exceeds the configured threshold (default 4), via Tree-sitter queries rather than hand-walked AST nodes.
3. **Duplicate detection at scale** — MinHash signatures per code block + LSH bucketing to find near-duplicate candidates, then a cheaper exact comparison only within candidate buckets. Avoids the O(n²) blowup of naive pairwise comparison.
4. **Effort scoring, revised.** Replace the single "Refactor Hours" number with:
   - Raw counts (complex components, dead files, security risks) — always shown
   - A tier: Low / Medium / High, derived from simple bucket rules on those counts
   - A note that hour estimates will be added once real fix-time data exists (from opt-in telemetry on how long users spend after opening a flagged item)

---

## Phase 4: GitHub integration & security risk scanning

1. **Auth** — OAuth device flow preferred; PAT as fallback, scoped minimally (repo:read, not full repo).
2. **API usage** — GraphQL for bulk metadata (commit frequency, branch health) in single requests; REST with conditional `If-None-Match` (ETag) requests where GraphQL doesn't fit; exponential backoff on rate-limit responses; surface remaining quota in the UI so users understand why a scan might pause.
3. **Secret detection** — regex for known key formats (AWS, GitHub tokens, etc.) *combined with* Shannon entropy scoring on generic strings, plus a `.healthdashboard-baseline.json` allowlist so a user can mark a known false positive once and not see it again.
4. **Dependency vulnerabilities** — query an existing vulnerability database (e.g., OSV.dev's API) against `requirements.txt`/`package.json` rather than maintaining a hand-rolled pattern list, which will always lag behind real CVE data.
5. **Actionable fixes** — clicking a finding opens a tree view with safe delete/archive actions, each reversible (move to a `.trash/` staging area, don't hard-delete).

---

## Phase 5: Reliability, testing & quality gates

This replaces the original "Phase 4: Polish, Testing, & Alpha Release" — testing moves from an afterthought to a parallel track starting in Phase 2.

- **Testing pyramid:**
  - Unit tests with golden files for parser output (input file → expected AST shape/metrics, checked into the repo)
  - Integration tests via `@vscode/test-electron` for the extension host behavior
  - Load tests against real-world repos of varying size (1k, 10k, 100k LOC) with a defined performance budget (e.g., incremental scan on a single-file save completes in <500ms)
- **Error boundaries.** Every analysis stage (parse → complexity → duplicates → secrets) fails independently. A crash in the duplicate-detection worker degrades to "duplicates unavailable this scan," not a dead extension.
- **CI pipeline** (GitHub Actions or equivalent): lint, typecheck, unit + integration tests, package build — on every PR, blocking merge on failure.
- **Observability.** Opt-in, anonymized error reporting (stack traces and error codes only, never file paths or content) so real failures get surfaced instead of silently accumulating in users' Output panels.

---

## Phase 6: Packaging, versioning & release

- **Semver discipline** with a maintained changelog — the SQLite cache schema is a versioned artifact; bump the schema version and write a migration (or safe wipe-and-rebuild) path whenever it changes.
- **Beta/Insiders channel** on the VS Code Marketplace before promoting a build to stable — catches environment-specific breakage (OS, VS Code version) before it reaches everyone.
- **Feature flags** on the higher-risk analyzers (duplicate detection, secret scanning) so a bad release can be mitigated by disabling a feature remotely, without a full re-publish cycle.
- **Marketplace listing checklist** — permissions justified in the description, privacy notice linked, screenshots reflect current UI (a common source of first-review rejection).

---

## Execution plan — how, when, why

This is the page you asked for: what to actually do, in what order, and why each phase earns its place before the next one starts.

| Phase | How | Why this exists | When to start / move on | Priority | Exit criteria |
|---|---|---|---|---|---|
| 0. Architecture decision | Write a one-page ADR: Node-only vs. Python sidecar, with the trigger condition for adding a sidecar later | Prevents an unexamined dependency from shaping every later phase | Before any code is written | Must | ADR merged; team agrees on the trigger condition for adding a sidecar |
| 1. Security & permissions | Implement `secretStorage` token handling, least-privilege manifest, sanitization pass | Retrofitting security after Phase 2 ships means re-auditing code that already handles user repos | Immediately after Phase 0 | Must | Manifest reviewed; no plaintext credential storage anywhere in the codebase |
| 2. MVP scanning engine | Workspace walk + incremental file-watcher scan + basic webview | Validates the core loop (scan → display) works before adding any heuristic complexity on top of it | After Phase 1 | Must | Scans a 10k-LOC repo end-to-end without crashing; incremental re-scan on save works |
| 3. Deep intelligence | Tree-sitter integration, complexity + MinHash duplicate detection, tiered effort scoring | This is the actual differentiator — v1's flat "line count" metrics don't tell a developer anything a file explorer doesn't already show | After Phase 2's scan loop is stable and tested | Should | Complexity and duplicate detection both run on a 50k-LOC repo in under the performance budget |
| 4. GitHub integration | OAuth flow, GraphQL bulk fetch, secret + dependency scanning with baseline file | Extends value beyond the local workspace — but only after local scanning is trustworthy, since GitHub data compounds on top of it | After Phase 3, or in parallel if a second engineer is available | Should | Rate-limit handling verified under load; baseline file suppresses a marked false positive correctly |
| 5. Reliability & testing | Golden-file tests, `@vscode/test-electron` suite, CI pipeline, error boundaries | This is not a separate phase you do once at the end — the exit criteria for Phases 2–4 above already assume tests exist. This phase is where the harness itself gets built and backfilled | Start the test harness in parallel with Phase 2; treat as continuously active, not a discrete step | Must | CI blocks merges on failing tests; every analyzer has at least one golden-file test |
| 6. Packaging & release | Beta channel publish, feature flags on risky analyzers, semver + changelog discipline | This is the actual answer to "runs without failure" — not a guarantee of zero bugs, but a release process that catches and contains them | After Phase 5's CI is green and a beta cohort is identified | Must | Beta channel live for at least one release cycle with no P0 issues before stable promotion |

**What "actually useful" filters to when you're short on time:** if forced to cut scope for a faster alpha, keep Phases 0–2 and 5 (architecture, security, MVP loop, and the test harness underneath it) as non-negotiable. Phases 3–4 (deep intelligence, GitHub integration) are where you can ship a thinner version — fewer heuristics, no GitHub integration in v1 — without undermining the tool's core trustworthiness. Cutting Phase 5 instead, to ship Phase 3/4 features faster, is the trade that looks fine in week one and produces silently wrong numbers in week four.

---

## On "bug-free": what this plan actually targets

No shipped software is bug-free, and a plan that promises it is making a claim it can't keep. What's achievable, and what this plan is built around instead:

- **Bounded blast radius** — error boundaries per analysis stage mean one broken analyzer degrades a feature, not the whole extension.
- **Fast detection** — opt-in telemetry and CI catch regressions before or shortly after they reach users, instead of surfacing as silent wrong numbers nobody reports.
- **Fast rollback** — feature flags let you disable a broken analyzer remotely; a beta channel means most users never see a bad build at all.
- **Honest uncertainty** — the effort-tier change in Phase 3 is part of this: a tool that says "Medium confidence" is more reliable in practice than one that states a false-precision number and is occasionally very wrong.

That's the real target: not "no bugs," but bugs that are contained, caught fast, and reversible.
