import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { API_URL } from './api'

type Product = {
  id: number
  name: string
  price: number
  category: string
  stock: number
  description?: string
}

type CartItem = {
  product: Product
  quantity: number
}

type Customer = {
  user_id: string
  name: string
  email: string
  role: string
}

const categories = [
  { name: 'All', icon: '🛍️' },
  { name: 'Electronics', icon: '📱' },
  { name: 'Fashion', icon: '👕' },
  { name: 'Home & Living', icon: '🏠' },
  { name: 'Beauty', icon: '✨' },
  { name: 'Groceries', icon: '🥑' },
  { name: 'Footwear', icon: '👟' },
]

const categoryImages: Record<string, string> = {
  Electronics:
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=85',
  Fashion:
    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=85',
  'Home & Living':
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85',
  Beauty:
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85',
  Groceries:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85',
  Footwear:
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(price)
}

function productImage(category: string) {
  return (
    categoryImages[category] ||
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85'
  )
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortOrder, setSortOrder] = useState('featured')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('shopora_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [accountOpen, setAccountOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login')
  const [cartOpen, setCartOpen] = useState(false)

  const [customer, setCustomer] = useState<Customer | null>(() => {
    const savedCustomer = localStorage.getItem('shopora_user')

    if (!savedCustomer) return null

    try {
      return JSON.parse(savedCustomer) as Customer
    } catch {
      localStorage.removeItem('shopora_user')
      localStorage.removeItem('shopora_token')
      return null
    }
  })

  const [accountName, setAccountName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')
  const [accountError, setAccountError] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [detailQuantity, setDetailQuantity] = useState(1)

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/products`)

        if (!response.ok) {
          throw new Error('Could not load products.')
        }

        const data: Product[] = await response.json()
        setProducts(data)
      } catch {
        setError('Unable to load products. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('shopora_cart', JSON.stringify(cart))
    } catch {
      console.error('Unable to save cart.')
    }
  }, [cart])

  const filteredProducts = products
    .filter((product) => {
      const text =
        `${product.name} ${product.category} ${product.description || ''}`

      const matchesSearch = text
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesCategory =
        category === 'All' ||
        product.category.toLowerCase() === category.toLowerCase()

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      if (sortOrder === 'price-low') return a.price - b.price
      if (sortOrder === 'price-high') return b.price - a.price
      return 0
    })

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const cartTotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  )

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setAccountLoading(true)
    setAccountError('')
    setAccountMessage('')

    try {
      const endpoint =
        accountMode === 'register' ? '/register' : '/login'

      const payload =
        accountMode === 'register'
          ? {
              name: accountName.trim(),
              email: accountEmail.trim(),
              password: accountPassword,
            }
          : {
              email: accountEmail.trim(),
              password: accountPassword,
            }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item: { msg?: string }) => item.msg).join(', ')
          : data.detail

        throw new Error(detail || data.message || 'Something went wrong.')
      }

      if (accountMode === 'register') {
        setAccountMode('login')
        setAccountName('')
        setAccountPassword('')
        setAccountMessage('Registration successful. Please log in.')
        return
      }

      if (data.role !== 'customer') {
        throw new Error('This account is not registered as a customer.')
      }

      const loggedInCustomer: Customer = {
        user_id: String(data.user_id),
        name: data.name,
        email: data.email,
        role: data.role,
      }

      localStorage.setItem('shopora_token', data.access_token)
      localStorage.setItem('shopora_user', JSON.stringify(loggedInCustomer))

      setCustomer(loggedInCustomer)
      setAccountPassword('')
      setAccountOpen(false)
      setAccountMessage('')
      setAccountError('')
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : 'Unable to connect to Shopora.',
      )
    } finally {
      setAccountLoading(false)
    }
  }

  function openAccount() {
    setAccountMessage('')
    setAccountError('')
    setAccountPassword('')
    setAccountOpen(true)
  }

  function logoutCustomer() {
    localStorage.removeItem('shopora_token')
    localStorage.removeItem('shopora_user')

    setCustomer(null)
    setAccountOpen(false)
    setAccountPassword('')
    setAccountMessage('')
    setAccountError('')
  }

  function addToCart(product: Product, quantity = 1) {
    if (product.stock <= 0 || quantity <= 0) return

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id,
      )

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + quantity,
                  product.stock,
                ),
              }
            : item,
        )
      }

      return [
        ...current,
        {
          product,
          quantity: Math.min(quantity, product.stock),
        },
      ]
    })
  }

  function changeQuantity(productId: number, amount: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id !== productId) return item

          const next = item.quantity + amount

          if (next > item.product.stock) return item

          return { ...item, quantity: next }
        })
        .filter((item) => item.quantity > 0),
    )
  }

  function openProduct(product: Product) {
    setSelectedProduct(product)
    setDetailQuantity(1)
  }

  function goToSeller() {
    window.location.href = '/seller'
  }

  const accountModal = accountOpen ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => setAccountOpen(false)}
          className="absolute right-5 top-4 rounded-lg px-3 py-1 text-2xl text-stone-500 hover:bg-stone-100"
          aria-label="Close account form"
        >
          ×
        </button>

        {customer ? (
          <>
            <h2 className="text-2xl font-black text-stone-900">
              Your account
            </h2>

            <p className="mt-5 text-sm text-stone-500">Welcome back,</p>

            <p className="mt-1 text-xl font-bold text-orange-700">
              {customer.name}
            </p>

            <p className="mt-2 text-sm text-stone-600">
              {customer.email}
            </p>

            <button
              onClick={logoutCustomer}
              className="mt-7 w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-stone-900">
              {accountMode === 'login'
                ? 'Welcome back'
                : 'Create your account'}
            </h2>

            <p className="mt-2 text-sm text-stone-500">
              {accountMode === 'login'
                ? 'Log in to your Shopora customer account.'
                : 'Join Shopora and start shopping.'}
            </p>

            {accountMessage && (
              <div className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                {accountMessage}
              </div>
            )}

            {accountError && (
              <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {accountError}
              </div>
            )}

            <form onSubmit={handleAccountSubmit} className="mt-6 space-y-4">
              {accountMode === 'register' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Full name
                  </label>

                  <input
                    type="text"
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Email address
                </label>

                <input
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Password
                </label>

                <input
                  type="password"
                  value={accountPassword}
                  onChange={(event) =>
                    setAccountPassword(event.target.value)
                  }
                  required
                  minLength={accountMode === 'register' ? 8 : 1}
                  maxLength={128}
                  autoComplete={
                    accountMode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                disabled={accountLoading}
                className="w-full rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {accountLoading
                  ? 'Please wait...'
                  : accountMode === 'login'
                    ? 'Log in'
                    : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-600">
              {accountMode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setAccountMode(
                    accountMode === 'login' ? 'register' : 'login',
                  )
                  setAccountMessage('')
                  setAccountError('')
                  setAccountPassword('')
                }}
                className="font-bold text-orange-700 hover:underline"
              >
                {accountMode === 'login' ? 'Register' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  ) : null

  const cartDrawer = cartOpen ? (
    <CartDrawer
      cart={cart}
      cartCount={cartCount}
      cartTotal={cartTotal}
      onClose={() => setCartOpen(false)}
      onChangeQuantity={changeQuantity}
      onRemove={(productId) =>
        setCart((current) =>
          current.filter((item) => item.product.id !== productId),
        )
      }
    />
  ) : null

  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-orange-50 p-4 text-stone-900 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setSelectedProduct(null)}
              className="font-bold text-orange-700"
            >
              ← Back to shopping
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={openAccount}
                className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700"
              >
                {customer ? customer.name.split(' ')[0] : 'Account'}
              </button>

              <button
                onClick={() => setCartOpen(true)}
                className="rounded-xl bg-orange-600 px-5 py-3 font-bold text-white"
              >
                Cart ({cartCount})
              </button>
            </div>
          </div>

          <div className="grid gap-8 rounded-3xl bg-white p-5 shadow-lg md:grid-cols-2 md:p-10">
            <img
              src={productImage(selectedProduct.category)}
              alt={selectedProduct.name}
              className="h-80 w-full rounded-2xl object-cover md:h-full"
            />

            <div>
              <p className="font-bold text-orange-600">
                {selectedProduct.category}
              </p>

              <h1 className="mt-3 text-3xl font-black">
                {selectedProduct.name}
              </h1>

              <p className="mt-5 text-3xl font-black text-orange-600">
                {formatPrice(selectedProduct.price)}
              </p>

              <h2 className="mt-7 font-bold">Product description</h2>

              <p className="mt-2 leading-7 text-stone-600">
                {selectedProduct.description || 'No description available.'}
              </p>

              <p className="mt-5 text-sm text-stone-500">
                {selectedProduct.stock > 0
                  ? `${selectedProduct.stock} available`
                  : 'Out of stock'}
              </p>

              <div className="mt-6 flex items-center gap-5">
                <button
                  disabled={detailQuantity <= 1}
                  onClick={() =>
                    setDetailQuantity((value) => Math.max(1, value - 1))
                  }
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  −
                </button>

                <span className="font-bold">{detailQuantity}</span>

                <button
                  disabled={detailQuantity >= selectedProduct.stock}
                  onClick={() =>
                    setDetailQuantity((value) =>
                      Math.min(selectedProduct.stock, value + 1),
                    )
                  }
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <p className="mt-5 text-lg font-black">
                Total: {formatPrice(selectedProduct.price * detailQuantity)}
              </p>

              <button
                disabled={selectedProduct.stock <= 0}
                onClick={() => {
                  addToCart(selectedProduct, detailQuantity)
                  setSelectedProduct(null)
                  setCartOpen(true)
                }}
                className="mt-6 w-full rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700 disabled:bg-stone-300"
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>

        {accountModal}
        {cartDrawer}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffaf5] text-stone-900">
      <div className="bg-orange-700 px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
        Shopora — Discover great deals from sellers across Nigeria
      </div>

      <header className="sticky top-0 z-30 border-b border-orange-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-6">
          <a
            href="/"
            className="text-3xl font-black tracking-tight text-orange-600"
          >
            Shopora<span className="text-stone-900">.</span>
          </a>

          <div className="order-3 flex w-full items-center rounded-full border border-stone-200 bg-stone-50 px-4 sm:order-none sm:flex-1">
            <span className="text-xl text-orange-600">⌕</span>

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                document.getElementById('products')?.scrollIntoView({
                  behavior: 'smooth',
                })
              }}
              placeholder="Search products, brands and categories..."
              className="w-full bg-transparent px-3 py-3.5 text-sm outline-none"
              aria-label="Search products"
            />
          </div>

          <button
            onClick={goToSeller}
            className="rounded-full px-3 py-2 text-sm font-bold text-stone-700 hover:bg-orange-50 hover:text-orange-700"
          >
            Sell on Shopora
          </button>

          <button
            onClick={openAccount}
            className="rounded-full border border-orange-200 px-4 py-3 text-sm font-bold text-orange-700 hover:bg-orange-50"
          >
            {customer ? customer.name.split(' ')[0] : 'Account'}
          </button>

          <button
            onClick={() => setCartOpen(true)}
            className="rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-orange-700"
          >
            🛒 Cart ({cartCount})
          </button>
        </div>

        <nav className="border-t border-orange-50">
          <div className="mx-auto flex max-w-7xl gap-7 overflow-x-auto px-4 py-3">
            {categories.map((item) => (
              <button
                key={item.name}
                onClick={() => setCategory(item.name)}
                className={`whitespace-nowrap text-sm font-semibold ${
                  category === item.name
                    ? 'text-orange-700'
                    : 'text-stone-600 hover:text-orange-600'
                }`}
              >
                {item.icon} {item.name}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4">
        <section className="relative mt-5 min-h-[420px] overflow-hidden rounded-3xl bg-orange-700 text-white sm:min-h-[490px]">
          <img
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=90"
            alt="Shopping at a modern retail store"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

          <div className="relative z-10 flex min-h-[420px] max-w-2xl flex-col justify-center px-6 py-14 sm:min-h-[490px] sm:px-12">
            <span className="w-fit rounded-full bg-orange-500 px-4 py-2 text-xs font-bold uppercase tracking-widest">
              Welcome to Shopora
            </span>

            <h1 className="mt-6 text-5xl font-black leading-tight sm:text-6xl">
              Everything you need.
              <span className="block text-orange-300">
                All in one place.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-white/90 sm:text-lg">
              Shop amazing products from independent sellers
              across Nigeria. Discover, compare and shop with ease.
            </p>

            <button
              onClick={() =>
                document.getElementById('products')?.scrollIntoView({
                  behavior: 'smooth',
                })
              }
              className="mt-8 w-fit rounded-full bg-orange-500 px-8 py-4 font-bold text-white shadow-lg hover:bg-orange-600"
            >
              Shop now →
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 py-7 md:grid-cols-4">
          {[
            {
              icon: '🚚',
              title: 'Convenient shopping',
              text: 'Shop from anywhere',
            },
            {
              icon: '🏪',
              title: 'Multiple sellers',
              text: 'Discover local businesses',
            },
            {
              icon: '💳',
              title: 'Flexible payments',
              text: 'Payment options at checkout',
            },
            {
              icon: '📦',
              title: 'Order management',
              text: 'Keep track of purchases',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-orange-100 bg-white p-4 sm:p-5"
            >
              <span className="text-2xl">{item.icon}</span>
              <h3 className="mt-3 text-sm font-bold sm:text-base">
                {item.title}
              </h3>
              <p className="mt-1 text-xs text-stone-500 sm:text-sm">
                {item.text}
              </p>
            </div>
          ))}
        </section>

        <section className="py-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
                Explore Shopora
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Shop by category
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories
              .filter((item) => item.name !== 'All')
              .map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    setCategory(item.name)
                    document.getElementById('products')?.scrollIntoView({
                      behavior: 'smooth',
                    })
                  }}
                  className="group overflow-hidden rounded-2xl border border-orange-100 bg-white text-left transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <img
                    src={productImage(item.name)}
                    alt={item.name}
                    loading="lazy"
                    className="h-32 w-full object-cover transition group-hover:scale-105 sm:h-44"
                  />

                  <div className="flex items-center justify-between p-3 sm:p-4">
                    <span className="text-sm font-bold sm:text-base">
                      {item.icon} {item.name}
                    </span>
                    <span className="text-orange-600">→</span>
                  </div>
                </button>
              ))}
          </div>
        </section>

        <section id="products" className="scroll-mt-40 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
                Discover more
              </p>

              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Products for you
              </h2>

              <p className="mt-2 text-sm text-stone-500">
                {filteredProducts.length} products available
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {category !== 'All' && (
                <button
                  onClick={() => setCategory('All')}
                  className="text-sm font-semibold text-orange-700"
                >
                  Clear category
                </button>
              )}

              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none"
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </div>
          </div>

          {loading && (
            <p className="py-16 text-center text-stone-500">
              Loading products...
            </p>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-5 text-red-700">
              {error}
              <button
                onClick={() => window.location.reload()}
                className="ml-3 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-12 text-center">
              <p className="text-4xl">🔎</p>
              <h3 className="mt-4 text-xl font-bold">
                No products found
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                Try a different search or category.
              </p>
              <button
                onClick={() => {
                  setSearch('')
                  setCategory('All')
                }}
                className="mt-5 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white"
              >
                Show all products
              </button>
            </div>
          )}

          {!loading && !error && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-orange-100 bg-white transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <button
                    onClick={() => openProduct(product)}
                    className="block w-full text-left"
                  >
                    <div className="relative">
                      <img
                        src={productImage(product.category)}
                        alt={product.name}
                        loading="lazy"
                        className="h-40 w-full object-cover sm:h-56"
                      />

                      <span className="absolute left-2 top-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-orange-700">
                        {product.category}
                      </span>
                    </div>
                  </button>

                  <div className="p-3 sm:p-4">
                    <button
                      onClick={() => openProduct(product)}
                      className="line-clamp-2 min-h-10 text-left text-sm font-bold sm:text-base"
                    >
                      {product.name}
                    </button>

                    <p className="mt-3 text-base font-black text-orange-700 sm:text-lg">
                      {formatPrice(product.price)}
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      {product.stock > 0
                        ? `${product.stock} in stock`
                        : 'Out of stock'}
                    </p>

                    <button
                      disabled={product.stock <= 0}
                      onClick={() => openProduct(product)}
                      className="mt-4 w-full rounded-full bg-orange-600 px-3 py-3 text-xs font-bold text-white transition hover:bg-orange-700 disabled:bg-stone-300 sm:text-sm"
                    >
                      View product
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="my-10 overflow-hidden rounded-3xl bg-orange-600 text-white">
          <div className="grid md:grid-cols-2">
            <div className="flex flex-col justify-center p-7 sm:p-12">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-100">
                Grow with Shopora
              </p>

              <h2 className="mt-4 text-3xl font-black sm:text-4xl">
                Own a business?
                <span className="block text-orange-100">
                  Start selling online.
                </span>
              </h2>

              <p className="mt-4 max-w-md leading-7 text-white/90">
                Create your seller account and introduce your products
                to customers across Nigeria.
              </p>

              <button
                onClick={goToSeller}
                className="mt-7 w-fit rounded-full bg-white px-7 py-4 font-bold text-orange-700 hover:bg-orange-50"
              >
                Start selling →
              </button>
            </div>

            <img
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85"
              alt="Small business owner serving a customer"
              loading="lazy"
              className="h-64 w-full object-cover md:h-full"
            />
          </div>
        </section>
      </main>

      <footer className="mt-10 bg-stone-950 px-5 py-12 text-stone-300">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <h2 className="text-3xl font-black text-orange-500">
              Shopora.
            </h2>
            <p className="mt-3 text-sm leading-6">
              Your marketplace for discovering products and
              independent sellers across Nigeria.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white">Shopping</h3>
            <p className="mt-3 text-sm">Browse products</p>
            <p className="mt-2 text-sm">Explore categories</p>
          </div>

          <div>
            <h3 className="font-bold text-white">For sellers</h3>
            <button
              onClick={goToSeller}
              className="mt-3 text-sm hover:text-orange-400"
            >
              Sell on Shopora
            </button>
          </div>

          <div>
            <h3 className="font-bold text-white">Customer support</h3>
            <p className="mt-3 text-sm">Help and enquiries</p>
            <p className="mt-2 text-sm">Order information</p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-7xl border-t border-stone-800 pt-6 text-center text-xs text-stone-500">
          © {new Date().getFullYear()} Shopora. All rights reserved.
          Prices are displayed in Nigerian Naira (NGN).
        </p>
      </footer>

      {accountModal}
      {cartDrawer}
    </div>
  )
}

type CartDrawerProps = {
  cart: CartItem[]
  cartCount: number
  cartTotal: number
  onClose: () => void
  onChangeQuantity: (productId: number, amount: number) => void
  onRemove: (productId: number) => void
}

function CartDrawer({
  cart,
  cartCount,
  cartTotal,
  onClose,
  onChangeQuantity,
  onRemove,
}: CartDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-black">
            Your cart ({cartCount})
          </h2>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-2xl hover:bg-stone-100"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-5xl">🛒</p>
              <h3 className="mt-4 font-bold">
                Your cart is empty
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                Add products to get started.
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="border-b border-stone-100 pb-5"
                >
                  <div className="flex gap-3">
                    <img
                      src={productImage(item.product.category)}
                      alt={item.product.name}
                      className="h-20 w-20 rounded-xl object-cover"
                    />

                    <div>
                      <h3 className="font-bold">
                        {item.product.name}
                      </h3>
                      <p className="mt-1 font-semibold text-orange-700">
                        {formatPrice(item.product.price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <button
                      onClick={() =>
                        onChangeQuantity(item.product.id, -1)
                      }
                      className="rounded-lg border px-3 py-1"
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        onChangeQuantity(item.product.id, 1)
                      }
                      disabled={item.quantity >= item.product.stock}
                      className="rounded-lg border px-3 py-1 disabled:opacity-40"
                    >
                      +
                    </button>

                    <button
                      onClick={() => onRemove(item.product.id)}
                      className="ml-auto text-sm font-semibold text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t p-5">
            <div className="mb-4 flex justify-between text-lg font-black">
              <span>Subtotal</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>

            <p className="mb-4 text-xs leading-5 text-stone-500">
              Checkout and payment are not connected yet.
              Your cart is saved in this browser.
            </p>

            <button
              onClick={() =>
                window.alert(
                  'Checkout is not connected yet. Your cart is saved.',
                )
              }
              className="w-full rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700"
            >
              Continue to checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

export default App