import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

console.log('Clerk Key:', clerkPubKey ? 'Present' : 'Missing')
console.log('API URL:', import.meta.env.VITE_API_URL)

if (!clerkPubKey) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable")
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {clerkPubKey ? (
        <ClerkProvider publishableKey={clerkPubKey}>
          <App />
        </ClerkProvider>
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
            <p className="text-gray-700 mb-4">
              Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.
            </p>
            <p className="text-sm text-gray-600">
              Please check your <code>.env</code> file in the frontend directory.
            </p>
          </div>
        </div>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
