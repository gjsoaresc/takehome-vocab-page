import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LoadingState } from './components/States'
import { ToastHost } from './components/ui/Toast'
import { CelebrationProvider } from './lib/celebrate'
import { UserProvider } from './lib/user-context'
import { Home } from './routes/home'

const Learn = lazy(() => import('./routes/learn'))
const Quiz = lazy(() => import('./routes/quiz'))
const Matching = lazy(() => import('./routes/matching'))
const Game = lazy(() => import('./routes/game'))
const Stats = lazy(() => import('./routes/stats'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserProvider>
          <CelebrationProvider>
            <ToastHost>
              <Layout>
                <Suspense fallback={<LoadingState />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/learn" element={<Learn />} />
                    <Route path="/quiz" element={<Quiz />} />
                    <Route path="/matching" element={<Matching />} />
                    <Route path="/game" element={<Game />} />
                    <Route path="/stats" element={<Stats />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ToastHost>
          </CelebrationProvider>
        </UserProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
