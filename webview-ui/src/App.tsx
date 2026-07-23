import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4 text-blue-400">GIT-Alpha Dashboard</h1>
      <p className="text-gray-300 mb-8 text-center max-w-lg">
        This is the MVP core scanning engine webview. Code quality and health metrics will appear here.
      </p>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <p className="mb-4">React + Tailwind + Vite is working!</p>
        <button 
          onClick={() => setCount((c) => c + 1)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
