import { useState, useEffect } from 'react';
import { vscode } from './utilities/vscode';

function App() {
  const [scanStats, setScanStats] = useState({
    totalFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    complexBlocks: 0,
    duplicateBlocks: 0,
    securityRisks: 0,
    vulnerabilities: 0,
    effortTier: 'Low',
    message: 'Waiting for scan data...'
  });

  useEffect(() => {
    // Listen for messages sent from the extension host
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'scanComplete') {
        setScanStats({
          totalFiles: message.payload.totalFiles,
          analyzedFiles: message.payload.analyzedFiles,
          failedFiles: message.payload.failedFiles,
          complexBlocks: message.payload.complexBlocks,
          duplicateBlocks: message.payload.duplicateBlocks || 0,
          securityRisks: message.payload.securityRisks || 0,
          vulnerabilities: message.payload.vulnerabilities || 0,
          effortTier: message.payload.effortTier || 'Low',
          message: message.payload.message
        });
      } else if (message.type === 'scanFailed') {
        setScanStats(prev => ({ ...prev, message: 'Scan completely failed.' }));
      }
    };

    window.addEventListener('message', handleMessage);

    // Request scan as soon as the webview finishes loading & mounting
    vscode.postMessage({ type: 'requestRescan' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">GIT-Alpha Dashboard</h1>
        <p className="text-gray-400 mt-2">{scanStats.message}</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-lg text-gray-400 font-semibold mb-2">Total Files</h2>
          <p className="text-5xl font-bold text-white">{scanStats.totalFiles}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-lg text-gray-400 font-semibold mb-2">Successfully Analyzed</h2>
          <p className="text-5xl font-bold text-green-400">{scanStats.analyzedFiles}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-lg text-gray-400 font-semibold mb-2">Failed Files</h2>
          <p className="text-5xl font-bold text-red-500">{scanStats.failedFiles}</p>
        </div>

        <div className="bg-blue-900 bg-opacity-20 p-6 rounded-lg shadow-lg border border-blue-800">
          <h2 className="text-lg text-blue-300 font-semibold mb-2">Complex AST Blocks</h2>
          <p className="text-5xl font-bold text-blue-400">{scanStats.complexBlocks}</p>
        </div>

        <div className="bg-amber-900 bg-opacity-20 p-6 rounded-lg shadow-lg border border-amber-800">
          <h2 className="text-lg text-amber-300 font-semibold mb-2">Duplicate Code Pairs</h2>
          <p className="text-5xl font-bold text-amber-400">{scanStats.duplicateBlocks}</p>
        </div>

        <div className="bg-red-900 bg-opacity-20 p-6 rounded-lg shadow-lg border border-red-800">
          <h2 className="text-lg text-red-300 font-semibold mb-2">Security Risks (Tokens/Keys)</h2>
          <p className="text-5xl font-bold text-red-400">{scanStats.securityRisks}</p>
        </div>

        <div className="bg-orange-900 bg-opacity-20 p-6 rounded-lg shadow-lg border border-orange-800">
          <h2 className="text-lg text-orange-300 font-semibold mb-2">CVE Vulnerabilities</h2>
          <p className="text-5xl font-bold text-orange-400">{scanStats.vulnerabilities}</p>
        </div>

        <div className="bg-purple-900 bg-opacity-20 p-6 rounded-lg shadow-lg border border-purple-800">
          <h2 className="text-lg text-purple-300 font-semibold mb-2">Project Effort Tier</h2>
          <p className={`text-4xl font-extrabold uppercase mt-2 ${
            scanStats.effortTier === 'High' ? 'text-red-400' :
            scanStats.effortTier === 'Medium' ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {scanStats.effortTier}
          </p>
        </div>
      </main>

      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Save any file in the workspace to trigger a fresh scan.</p>
      </div>
    </div>
  );
}

export default App;
