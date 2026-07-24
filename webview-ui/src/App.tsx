import { useState, useEffect } from 'react';
import { vscode } from './utilities/vscode';

function App() {
  const [scanStats, setScanStats] = useState({
    totalFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    complexBlocks: 0,
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
          message: message.payload.message
        });
      } else if (message.type === 'scanFailed') {
        setScanStats(prev => ({ ...prev, message: 'Scan completely failed.' }));
      }
    };

    window.addEventListener('message', handleMessage);

    // When the component loads, let's ask the extension to scan (optional, but good practice)
    // vscode.postMessage({ type: 'requestRescan' });

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

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </main>

      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Save any file in the workspace to trigger a fresh scan.</p>
      </div>
    </div>
  );
}

export default App;
