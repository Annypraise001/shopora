import { useState } from 'react'
import { API_URL } from './api'

type AuthMode = 'register' | 'login'

function SellerPage() {
  const [mode, setMode] = useState<AuthMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'login'
      ? 'login'
      : 'register',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')
    setMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (mode === 'register' && name.trim().length < 2) {
      setError('Enter your full name or business name.')
      return
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const endpoint =
        mode === 'register' ? '/seller/register' : '/seller/login'

      const payload =
        mode === 'register'
          ? {
              name: name.trim(),
              email: cleanEmail,
              password,
            }
          : {
              email: cleanEmail,
              password,
            }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const detail = data.detail

        const errorMessage =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((item: { msg?: string }) => item.msg || '')
                  .filter(Boolean)
                  .join(', ')
              : 'Request failed. Please try again.'

        throw new Error(errorMessage)
      }

      const token =
        data.access_token || data.token || data.accessToken

      if (mode === 'register') {
        if (token) {
          localStorage.setItem('shopora_seller_token', token)
          localStorage.setItem('shopora_seller_name', name.trim())
          window.location.href = '/seller/dashboard'
          return
        }

        setMessage('Account created. Sign in to continue.')
        setPassword('')
        setMode('login')
        return
      }

      if (!token) {
        throw new Error(
          'The server did not return a login token. We need to check the backend login response.',
        )
      }

      localStorage.setItem('shopora_seller_token', token)

      if (typeof data.name === 'string') {
        localStorage.setItem('shopora_seller_name', data.name)
      }

      window.location.href = '/seller/dashboard'
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          'Cannot connect to the backend. Make sure the server is running on port 8001.',
        )
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a
            href="/"
            className="text-2xl font-black tracking-tight text-orange-600"
          >
            Shopora<span className="text-stone-900">.</span>
          </a>

          <a
            href="/"
            className="text-sm font-semibold text-stone-600 hover:text-orange-600"
          >
            Back to shopping
          </a>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-14">
        <section className="hidden overflow-hidden rounded-[2rem] bg-stone-900 shadow-2xl shadow-stone-900/10 lg:block">
          <div className="relative min-h-[620px]">
            <img
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=85"
              alt="A shop owner serving a customer"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/10" />

            <div className="absolute inset-x-0 bottom-0 p-12">
              <p className="inline-flex rounded-full border border-orange-300/30 bg-orange-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                Shopora Seller Centre
              </p>

              <h1 className="mt-6 max-w-lg text-5xl font-black leading-[1.08] tracking-tight text-white">
                Your next big
                <span className="block text-orange-400">selling moment</span>
                starts here.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-stone-200">
                Bring your business online, reach new customers, and manage
                your shop with tools built for sellers.
              </p>

              <div className="mt-9 flex items-center gap-3 text-sm font-medium text-stone-200">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-400/20 text-orange-300">
                  ✓
                </span>
                A simpler way to grow your business
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg">
          <div className="mb-7 lg:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
              Shopora Seller Centre
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Your shop starts here.
            </h1>
          </div>

          <div className="rounded-[2rem] border border-stone-200/80 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
              Seller account
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {mode === 'register'
                ? 'Create your account'
                : 'Welcome back'}
            </h2>

            <p className="mt-3 text-sm leading-6 text-stone-500">
              {mode === 'register'
                ? 'Register to start your Shopora selling journey.'
                : 'Sign in to continue to your seller dashboard.'}
            </p>

            <div className="mt-8 grid grid-cols-2 rounded-2xl bg-stone-100 p-1.5">
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-xl px-3 py-3.5 text-sm font-bold transition ${
                  mode === 'register'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  mode === 'login'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Sign in
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            {message && (
              <div
                role="status"
                className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700"
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="seller-name"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Full name or business name
                  </label>

                  <input
                    id="seller-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name or shop name"
                    required
                    minLength={2}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="seller-email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email address
                </label>

                <input
                  id="seller-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="seller-password"
                    className="text-sm font-semibold"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    {showPassword ? 'Hide' : 'Show'} password
                  </button>
                </div>

                <input
                  id="seller-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3.5 text-sm outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                />

                {mode === 'register' && (
                  <p className="mt-2 text-xs text-stone-500">
                    Use at least 8 characters.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-orange-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 hover:shadow-orange-700/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'register'
                    ? 'Create seller account →'
                    : 'Sign in →'}
              </button>
            </form>

            <p className="mt-7 border-t border-stone-100 pt-6 text-center text-sm text-stone-600">
              {mode === 'register'
                ? 'Already have an account?'
                : 'New to Shopora?'}{' '}
              <button
                type="button"
                onClick={() =>
                  switchMode(
                    mode === 'register' ? 'login' : 'register',
                  )
                }
                className="font-bold text-orange-600 hover:text-orange-700"
              >
                {mode === 'register' ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SellerPage