import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.tsx'
import SellerPage from './sellerpage.tsx'
import SellerDashboard from './SellerDashboard.tsx'

type Route =
  | '/'
  | '/seller'
  | '/seller/dashboard'
  | '/404'

function normalizePath(path: string): Route {
  const normalized = path.replace(/\/+$/, '') || '/'

  const allowedRoutes: Route[] = [
    '/',
    '/seller',
    '/seller/dashboard',
  ]

  return allowedRoutes.includes(normalized as Route)
    ? (normalized as Route)
    : '/404'
}

function Root() {
  const [route, setRoute] = useState<Route>(() =>
    normalizePath(window.location.pathname),
  )

  useEffect(() => {
    const handleNavigation = () => {
      setRoute(normalizePath(window.location.pathname))
    }

    window.addEventListener('popstate', handleNavigation)

    return () => {
      window.removeEventListener('popstate', handleNavigation)
    }
  }, [])

  switch (route) {
    case '/seller':
      return <SellerPage />

    case '/seller/dashboard':
      return <SellerDashboard />

    case '/404':
      return (
        <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
              Shopora
            </p>

            <h1 className="mt-5 text-6xl font-bold">404</h1>

            <p className="mt-4 text-stone-400">
              The page you are looking for could not be found.
            </p>

            <a
              href="/"
              className="mt-8 inline-flex rounded-xl bg-orange-600 px-7 py-3 font-semibold text-white transition hover:bg-orange-700"
            >
              Return to Shopora
            </a>
          </div>
        </main>
      )

    default:
      return <App />
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)