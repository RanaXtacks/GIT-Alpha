import { useState, useEffect } from 'react';
import { vscode } from './utilities/vscode';
import { ErroredFile, DuplicatePair, SecurityDetail, GitHubRepoData } from './types';

function App() {
  const [scanStats, setScanStats] = useState({
    totalFiles: 0,
    codeFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    complexBlocks: 0,
    duplicateBlocks: 0,
    securityRisks: 0,
    vulnerabilities: 0,
    effortTier: 'Low',
    message: 'Waiting for scan data...',
    erroredFiles: [] as ErroredFile[],
    duplicatePairs: [] as DuplicatePair[],
    securityDetails: [] as SecurityDetail[]
  });

  const [githubData, setGithubData] = useState<GitHubRepoData | null>(null);
  const [brainFixes, setBrainFixes] = useState<Record<string, { loading: boolean; text?: string }>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'errors' | 'duplicates' | 'security' | 'vulnerabilities'>('all');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'scanComplete') {
        const payload = message.payload;
        setScanStats({
          totalFiles: payload.totalFiles || 0,
          codeFiles: payload.codeFiles || payload.analyzedFiles || 0,
          analyzedFiles: payload.analyzedFiles || 0,
          failedFiles: payload.failedFiles || 0,
          complexBlocks: payload.complexBlocks || 0,
          duplicateBlocks: payload.duplicateBlocks || 0,
          securityRisks: payload.securityRisks || 0,
          vulnerabilities: payload.vulnerabilities || 0,
          effortTier: payload.effortTier || 'Low',
          message: payload.message,
          erroredFiles: payload.erroredFiles || [],
          duplicatePairs: payload.duplicatePairs || [],
          securityDetails: payload.securityDetails || []
        });
      } else if (message.type === 'scanFailed') {
        setScanStats(prev => ({ ...prev, message: 'Scan completely failed.' }));
      } else if (message.type === 'githubData') {
        setGithubData(message.payload);
      } else if (message.type === 'brainLoading') {
        const file = message.payload.file;
        setBrainFixes(prev => ({ ...prev, [file]: { loading: true } }));
      } else if (message.type === 'brainAnalysis') {
        const { file, suggestion } = message.payload;
        setBrainFixes(prev => ({ ...prev, [file]: { loading: false, text: suggestion } }));
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'requestRescan' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const openFileInEditor = (path: string) => {
    vscode.postMessage({ type: 'openFile', path });
  };

  const askBrainToFix = (filePath: string) => {
    setBrainFixes(prev => ({ ...prev, [filePath]: { loading: true } }));
    vscode.postMessage({ type: 'requestBrainFix', file: filePath });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-10 font-sans">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="mb-8 border-b border-gray-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 tracking-tight">
            GIT-Alpha!!
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {scanStats.message}
          </p>
        </div>

        {/* GitHub Header Widget */}
        {githubData && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs flex items-center gap-4 text-gray-300">
            <div>
              <span className="text-gray-500 font-semibold block">REPOSITORY</span>
              <span className="font-medium text-white">{githubData.name}</span>
            </div>
            <div className="border-l border-gray-800 pl-3">
              <span className="text-gray-500 font-semibold block">STARS / FORKS</span>
              <span>⭐ {githubData.stars} &nbsp; 🍴 {githubData.forks}</span>
            </div>
            <div className="border-l border-gray-800 pl-3">
              <span className="text-gray-500 font-semibold block">OPEN ISSUES</span>
              <span className="text-amber-400 font-medium">{githubData.openIssues}</span>
            </div>
          </div>
        )}
      </header>

      {/* ── FILTER TABS ──────────────────────────────────────────────────────── */}
      <nav className="flex gap-2 mb-8 border-b border-gray-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'errors' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Errored Files
          {scanStats.failedFiles > 0 && (
            <span className="bg-red-900/80 text-red-200 text-xs px-2 py-0.5 rounded-full font-bold">
              {scanStats.failedFiles}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'duplicates' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Duplicates
          {scanStats.duplicateBlocks > 0 && (
            <span className="bg-amber-900/80 text-amber-200 text-xs px-2 py-0.5 rounded-full font-bold">
              {scanStats.duplicateBlocks}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'security' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Security Risks
          {scanStats.securityRisks > 0 && (
            <span className="bg-purple-900/80 text-purple-200 text-xs px-2 py-0.5 rounded-full font-bold">
              {scanStats.securityRisks}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('vulnerabilities')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            activeTab === 'vulnerabilities' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Vulnerabilities
          {scanStats.vulnerabilities > 0 && (
            <span className="bg-orange-900/80 text-orange-200 text-xs px-2 py-0.5 rounded-full font-bold">
              {scanStats.vulnerabilities}
            </span>
          )}
        </button>
      </nav>

      {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────────── */}
      {(activeTab === 'all') && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Code Files Scanned</h3>
              <p className="text-4xl font-extrabold text-white">{scanStats.codeFiles || scanStats.analyzedFiles}</p>
              <span className="text-xs text-gray-500 mt-2 block">Source code files analyzed ({scanStats.totalFiles} workspace files)</span>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">Successfully Parsed</h3>
              <p className="text-4xl font-extrabold text-emerald-400">{scanStats.analyzedFiles}</p>
              <span className="text-xs text-emerald-500/70 mt-2 block">Parse complete without errors</span>
            </div>

            <div className={`p-6 rounded-xl border shadow-xl ${
              scanStats.failedFiles > 0 ? 'bg-red-950/30 border-red-900/60' : 'bg-gray-900 border-gray-800'
            }`}>
              <h3 className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-1">Errored Files</h3>
              <p className="text-4xl font-extrabold text-red-400">{scanStats.failedFiles}</p>
              <span className="text-xs text-red-400/70 mt-2 block">
                {scanStats.failedFiles > 0 ? 'Requires attention (see Errored tab)' : 'No syntax errors'}
              </span>
            </div>

            <div className="bg-purple-950/30 p-6 rounded-xl border border-purple-900/60 shadow-xl">
              <h3 className="text-xs uppercase tracking-wider text-purple-300 font-semibold mb-1">Project Effort Tier</h3>
              <p className={`text-3xl font-black uppercase mt-1 ${
                scanStats.effortTier === 'High' ? 'text-red-400' :
                scanStats.effortTier === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {scanStats.effortTier}
              </p>
              <span className="text-xs text-purple-400/70 mt-2 block">Calculated from complexity & risks</span>
            </div>

          </div>

          {/* Secondary Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-blue-950/20 p-6 rounded-xl border border-blue-900/40">
              <h4 className="text-sm font-semibold text-blue-300 mb-1">Complex AST Blocks</h4>
              <p className="text-3xl font-bold text-blue-400">{scanStats.complexBlocks}</p>
              <p className="text-xs text-gray-400 mt-2">
                Control-flow statements (<code className="text-blue-300">if</code>, <code className="text-blue-300">for</code>, <code className="text-blue-300">while</code>, <code className="text-blue-300">try/catch</code>). High counts indicate complex branching logic that is harder to test and maintain.
              </p>
            </div>

            <div className="bg-amber-950/20 p-6 rounded-xl border border-amber-900/40">
              <h4 className="text-sm font-semibold text-amber-300 mb-1">Duplicate Code Pairs</h4>
              <p className="text-3xl font-bold text-amber-400">{scanStats.duplicateBlocks}</p>
              <p className="text-xs text-gray-400 mt-2">
                File pairs sharing &gt;75% token shingle similarity. High duplication means code should be refactored into reusable helper functions.
              </p>
            </div>

            <div className="bg-purple-950/20 p-6 rounded-xl border border-purple-900/40">
              <h4 className="text-sm font-semibold text-purple-300 mb-1">Security Risks</h4>
              <p className="text-3xl font-bold text-purple-400">{scanStats.securityRisks}</p>
              <p className="text-xs text-gray-400 mt-2">
                Hardcoded secret strings (API keys, private keys, passwords) detected via high Shannon entropy (&gt;4.8 bits/char) and pattern matching.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ERRORED FILES + BRAIN ─────────────────────────────────────── */}
      {(activeTab === 'errors' || activeTab === 'all') && scanStats.erroredFiles.length > 0 && (
        <section className="mb-10 bg-gray-900 rounded-xl border border-red-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
              <span>🚨</span> Errored Files ({scanStats.erroredFiles.length})
            </h2>
            <span className="text-xs text-gray-400">Click a file to open it in your editor</span>
          </div>

          <div className="space-y-4">
            {scanStats.erroredFiles.map(item => (
              <div key={item.file} className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <button
                    onClick={() => openFileInEditor(item.file)}
                    className="font-mono text-sm text-blue-400 hover:text-blue-300 underline text-left font-semibold"
                  >
                    📄 {item.file}
                  </button>

                  <button
                    onClick={() => askBrainToFix(item.file)}
                    disabled={brainFixes[item.file]?.loading}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 self-start md:self-auto shadow-md shadow-purple-900/30"
                  >
                    {brainFixes[item.file]?.loading ? (
                      <>
                        <span className="animate-spin">⏳</span> Asking Gemini...
                      </>
                    ) : (
                      <>
                        <span>🧠</span> Ask Brain to Fix
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-red-950/30 border border-red-900/40 rounded p-3 text-xs text-red-300 font-mono space-y-1">
                  {item.errors.map((err, idx) => (
                    <div key={idx}>⚠️ {err}</div>
                  ))}
                </div>

                {/* Gemini Brain Fix Suggestion Output */}
                {brainFixes[item.file]?.text && (
                  <div className="mt-4 bg-purple-950/40 border border-purple-800/60 rounded-lg p-4 text-xs text-purple-200">
                    <div className="font-bold text-purple-300 mb-2 flex items-center gap-2 text-sm">
                      <span>🧠</span> Gemini AI Brain Suggestion:
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-gray-200 leading-relaxed bg-gray-950/80 p-3 rounded border border-purple-900/40">
                      {brainFixes[item.file].text}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 3: DUPLICATES ────────────────────────────────────────────────── */}
      {(activeTab === 'duplicates' || activeTab === 'all') && scanStats.duplicatePairs.length > 0 && (
        <section className="mb-10 bg-gray-900 rounded-xl border border-amber-900/50 p-6">
          <h2 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
            <span>👯</span> Verified Duplicate File Pairs ({scanStats.duplicatePairs.length})
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            These files share high token similarity (&gt;75%). Consider merging or refactoring them to eliminate redundant logic.
          </p>

          <div className="space-y-3">
            {scanStats.duplicatePairs.map((pair, idx) => (
              <div key={idx} className="bg-gray-950 rounded-lg p-3 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between text-xs font-mono gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => openFileInEditor(pair.fileA)} className="text-amber-300 hover:underline">
                    📄 {pair.fileA}
                  </button>
                  <span className="text-gray-500 font-bold">↔</span>
                  <button onClick={() => openFileInEditor(pair.fileB)} className="text-amber-300 hover:underline">
                    📄 {pair.fileB}
                  </button>
                </div>
                <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800 text-2xs font-sans self-start md:self-auto">
                  ~75%+ Match
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 4: SECURITY RISKS EXPLAINER ────────────────────────────────── */}
      {(activeTab === 'security' || activeTab === 'all') && (
        <section className="mb-10 bg-gray-900 rounded-xl border border-purple-900/50 p-6">
          <h2 className="text-xl font-bold text-purple-400 mb-2 flex items-center gap-2">
            <span>🔐</span> Security Risks Explained
          </h2>

          <div className="bg-purple-950/30 border border-purple-900/40 rounded-lg p-4 text-xs text-purple-200 space-y-2 mb-4">
            <p className="font-semibold text-purple-300">Why is this number showing up?</p>
            <p>
              Security risks are hardcoded API keys, personal access tokens (GitHub, AWS), private keys, or high-entropy random strings sitting directly in your source code. 
              High-entropy strings have a character distribution that looks like a password or raw token ($H(X) &gt; 4.8$ bits/char).
            </p>
            <p className="text-purple-300 font-medium">
              💡 <strong>Action Required:</strong> Move these secrets into an environment file (<code className="text-purple-300">.env</code>) or use a secret manager like VS Code SecretStorage instead of hardcoding them.
            </p>
          </div>

          {scanStats.securityDetails.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {scanStats.securityDetails.slice(0, 30).map((sec, idx) => (
                <div key={idx} className="bg-gray-950 rounded p-2.5 border border-gray-800 text-xs font-mono flex items-center justify-between">
                  <button onClick={() => openFileInEditor(sec.file)} className="text-purple-300 hover:underline">
                    📄 {sec.file} <span className="text-gray-500">(Line {sec.line})</span>
                  </button>
                  <span className="bg-purple-950 text-purple-300 text-2xs px-2 py-0.5 rounded border border-purple-800">
                    {sec.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── TAB 5: CVE VULNERABILITIES EXPLAINER ────────────────────────────── */}
      {(activeTab === 'vulnerabilities' || activeTab === 'all') && (
        <section className="mb-10 bg-gray-900 rounded-xl border border-orange-900/50 p-6">
          <h2 className="text-xl font-bold text-orange-400 mb-2 flex items-center gap-2">
            <span>🛡️</span> CVE Vulnerabilities Explained
          </h2>

          <div className="bg-orange-950/30 border border-orange-900/40 rounded-lg p-4 text-xs text-orange-200 space-y-2">
            <p className="font-semibold text-orange-300">What is a CVE Vulnerability?</p>
            <p>
              CVE (Common Vulnerabilities and Exposures) refers to publicly disclosed security flaws found in third-party packages (npm or PyPI) imported by your project. 
              GIT-Alpha queries the official open OSV.dev database in real-time to check your dependencies.
            </p>
            <p className="text-orange-300 font-medium">
              💡 <strong>How to Fix:</strong> Run <code className="text-orange-300">npm audit fix</code> or upgrade the affected package versions in your <code className="text-orange-300">package.json</code> or <code className="text-orange-300">requirements.txt</code> file.
            </p>
          </div>
        </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="mt-12 text-center text-xs text-gray-500 border-t border-gray-900 pt-6">
        <p>GIT-Alpha!! — Real-time Deep Workspace Intelligence & AI Brain</p>
      </footer>
    </div>
  );
}

export default App;
