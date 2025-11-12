import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Connections from './pages/Connections'
import Pipelines from './pages/Pipelines'
import CreatePipeline from './pages/CreatePipeline'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/pipelines" replace />} />
                    <Route path="/connections" element={<Connections />} />
                    <Route path="/pipelines" element={<Pipelines />} />
                    <Route path="/pipelines/create" element={<CreatePipeline />} />
                  </Routes>
                </Layout>
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
