import { useEffect, useState } from 'react'
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

const categories = [
  { name: 'All', icon: '🛍️' },
  { name: 'Electronics', icon: '📱' },
  { name: 'Fashion', icon: '👕' },
  { name: 'Home & Living', icon: '🏠' },
  { name: 'Beauty', icon: '✨' },
  { name: 'Groceries', icon: '🥑' },
]

const images: Record<string, string> = {
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
    images[category] ||
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85'
  )
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortOrder, setSortOrder] = useState<
    'featured' | 'price-low' | 'price-high'
  >('featured')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('shopora_cart')
      return savedCart ? (JSON.parse(savedCart) as CartItem[]) : []
    } catch {
      return []
    }
  })

  const [cartOpen, setCartOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null)
  const [detailQuantity, setDetailQuantity] = useState(1)

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/products`)
        if (!response.ok) throw new Error('Could not load products.')

        const data: Product[] = await response.json()
        setProducts(data)
      } catch {
        setError(
          'Unable to load products. Check the backend connection and try again.',
        )
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
      console.error('Unable to save the cart in this browser.')
    }
  }, [cart])

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        `${product.name} ${product.category} ${product.description || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchesCategory =
        category === 'All' ||
        product.category.toLowerCase() === category.toLowerCase()

      return matchesSearch && matchesCategory
    })
    .sort((first, second) => {
      if (sortOrder === 'price-low') return first.price - second.price
      if (sortOrder === 'price-high') return second.price - first.price
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
        { product, quantity: Math.min(quantity, product.stock) },
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
      <div className="min-h-screen bg-[#f5f1e9] p-4 text-[#251d18] sm:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="font-semibold text-orange-600"
            >
              ← Back to products
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white"
            >
              Cart ({cartCount})
            </button>
          </div>

          <div className="grid gap-8 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-900/5 md:grid-cols-2 md:p-10">
            <img
              src={productImage(selectedProduct.category)}
              alt={`${selectedProduct.category} collection illustration`}
              className="h-72 w-full rounded-2xl object-cover md:h-96"
            />

            <div>
              <p className="mb-3 text-xs font-medium text-stone-500">
                Illustrative category image — seller product photos are not available yet.
              </p>

              <p className="font-semibold text-orange-600">
                {selectedProduct.category}
              </p>

              <h1 className="mt-3 text-3xl font-bold">
                {selectedProduct.name}
              </h1>

              <p className="mt-4 text-2xl font-bold text-orange-600">
                {formatPrice(selectedProduct.price)}
              </p>

              <h2 className="mt-6 font-bold">Product description</h2>

              <p className="mt-2 leading-7 text-gray-600">
                {selectedProduct.description || 'No description available.'}
              </p>

              <p className="mt-4 text-sm text-gray-500">
                {selectedProduct.stock > 0
                  ? `${selectedProduct.stock} in stock`
                  : 'Out of stock'}
              </p>

              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  disabled={detailQuantity <= 1}
                  onClick={() =>
                    setDetailQuantity((quantity) =>
                      Math.max(1, quantity - 1),
                    )
                  }
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  −
                </button>

                <span>{detailQuantity}</span>

                <button
                  type="button"
                  disabled={detailQuantity >= selectedProduct.stock}
                  onClick={() =>
                    setDetailQuantity((quantity) =>
                      Math.min(selectedProduct.stock, quantity + 1),
                    )
                  }
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <p className="mt-5 text-lg font-bold">
                Total: {formatPrice(selectedProduct.price * detailQuantity)}
              </p>

              <button
                type="button"
                disabled={selectedProduct.stock <= 0}
                onClick={() => {
                  addToCart(selectedProduct, detailQuantity)
                  setSelectedProduct(null)
                  setDetailQuantity(1)
                  setCartOpen(true)
                }}
                className="mt-6 w-full rounded-xl bg-orange-600 px-5 py-4 font-bold text-white hover:bg-orange-700 disabled:bg-gray-300"
              >
                {selectedProduct.stock > 0 ? 'Add to cart' : 'Out of stock'}
              </button>
            </div>
          </div>
        </div>

        {cartDrawer}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f1e9] text-[#251d18]">
      <div className="bg-[#2d211b] px-4 py-2 text-center text-xs font-medium tracking-wide text-[#f4d8ac] sm:text-sm">
        Discover great deals from sellers across Nigeria
      </div>

      <header className="sticky top-0 z-30 border-b border-[#e7dfd4] bg-[#fbf9f5]/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:gap-5 sm:py-5">
          <button
            type="button"
            onClick={() => {
              setCategory('All')
              setSearch('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="shrink-0 text-3xl font-black tracking-tight text-[#a85327] sm:text-4xl"
          >
            Shopora<span className="text-[#2d211b]">.</span>
          </button>

          <div className="order-3 flex min-w-full flex-1 items-center rounded-full border border-[#dfd6ca] bg-white px-4 transition focus-within:border-[#a85327] focus-within:ring-4 focus-within:ring-[#a85327]/10 sm:order-none sm:min-w-0">
            <span aria-hidden="true" className="text-xl text-[#a85327]">
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, categories and more..."
              aria-label="Search products"
              className="w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-stone-400"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/seller'
            }}
            className="ml-auto rounded-full border border-[#a85327] px-3 py-2.5 text-xs font-bold text-[#8e421f] transition hover:bg-[#f4e7d8] sm:ml-0 sm:px-5 sm:py-3 sm:text-sm"
          >
            Sell on Shopora
          </button>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="rounded-full bg-[#a85327] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#7b3b20]/15 transition hover:bg-[#88421f] sm:px-6 sm:py-3 sm:text-sm"
          >
            Cart ({cartCount})
          </button>
        </div>

        <nav className="border-t border-[#eee8df]">
          <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 sm:gap-8">
            {categories.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setCategory(item.name)}
                className={`whitespace-nowrap border-b-2 pb-1 text-sm transition ${
                  category === item.name
                    ? 'border-[#a85327] font-bold text-[#a85327]'
                    : 'border-transparent text-stone-600 hover:border-[#e8b579] hover:text-[#a85327]'
                }`}
              >
                {item.icon} {item.name}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:pt-8">
          <section className="relative isolate min-h-[500px] overflow-hidden rounded-[2rem] bg-[#211711] text-white shadow-2xl shadow-[#2d211b]/15 sm:min-h-[590px]">
            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=90"
              alt="Modern shopping and retail experience"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />

            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1a120e]/95 via-[#1a120e]/70 to-[#1a120e]/10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1a120e]/45 via-transparent to-transparent" />

            <div className="max-w-3xl px-6 py-20 sm:px-12 sm:py-28 md:py-32">
              <span className="inline-flex rounded-full border border-[#e6b778]/50 bg-[#211711]/30 px-4 py-2 text-[11px] font-bold tracking-[0.22em] text-[#f4d2a3] backdrop-blur-sm sm:text-xs">
                THOUGHTFULLY CURATED IN NIGERIA
              </span>

              <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[1.03] tracking-tight sm:text-6xl md:text-7xl">
                Find something
                <span className="block font-serif font-medium italic text-[#e8b579]">
                  wonderful.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-stone-200 sm:text-lg">
                Distinctive finds for everyday living, from independent sellers
                across Nigeria. Explore a marketplace with a little more meaning.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('products')?.scrollIntoView({
                      behavior: 'smooth',
                    })
                  }
                  className="rounded-full bg-[#c57643] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#ad6032]"
                >
                  Explore the collection <span aria-hidden="true">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/seller'
                  }}
                  className="rounded-full border border-white/40 bg-white/10 px-7 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Meet our sellers
                </button>
              </div>
            </div>
          </section>

          <section className="py-14 sm:py-16">
            <div className="mb-6">
              <p className="text-xs font-bold tracking-[0.22em] text-[#a85327]">
                THE SHOPORA EDIT
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold text-[#2d211b] sm:text-4xl">
                Discover your kind of lovely
              </h2>

              <p className="mt-2 text-stone-600">
                Browse considered collections from local businesses.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {categories
                .filter((item) => item.name !== 'All')
                .map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setCategory(item.name)
                      document.getElementById('products')?.scrollIntoView({
                        behavior: 'smooth',
                      })
                    }}
                    className="group overflow-hidden rounded-[1.5rem] border border-[#e7dfd4] bg-[#fbf9f5] text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#3a2618]/10"
                  >
                    <img
                      src={productImage(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="h-36 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-48"
                    />

                    <div className="flex items-center justify-between p-4 sm:p-5">
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-[#a85327]">
                          {item.icon} Collection
                        </span>

                        <h3 className="mt-1 font-serif text-xl font-bold text-[#2d211b]">
                          {item.name}
                        </h3>
                      </div>

                      <span
                        aria-hidden="true"
                        className="text-lg text-[#a85327] transition group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </section>

          <section className="my-4 overflow-hidden rounded-[2rem] bg-[#2d211b] text-white shadow-xl shadow-[#2d211b]/10">
            <div className="grid md:grid-cols-2">
              <div className="flex flex-col justify-center p-6 sm:p-10 md:p-12">
                <p className="text-xs font-bold tracking-[0.22em] text-[#e8b579]">
                  A MARKETPLACE WITH CHARACTER
                </p>

                <h2 className="mt-4 font-serif text-3xl font-bold sm:text-4xl">
                  Good things, closer to home.
                </h2>

                <p className="mt-4 leading-7 text-stone-300">
                  Every purchase brings you closer to independent makers and
                  businesses building something special across Nigeria.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('products')?.scrollIntoView({
                      behavior: 'smooth',
                    })
                  }
                  className="mt-6 w-fit rounded-full bg-[#c57643] px-6 py-3 font-bold text-white transition hover:bg-[#ad6032]"
                >
                  Start exploring →
                </button>
              </div>

              <div className="min-h-64 bg-black">
                <img
                  src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=85"
                  alt="A welcoming independent shop"
                  loading="lazy"
                  className="h-full min-h-64 max-h-[440px] w-full object-cover"
                />
              </div>
            </div>

            <p className="px-6 pb-5 text-xs text-stone-400 sm:px-10">
              Shop independent. Discover something different.
            </p>
          </section>

          <section className="py-10 sm:py-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.22em] text-[#a85327]">
                  MADE FOR DISCOVERY
                </p>

                <h2 className="mt-2 font-serif text-3xl font-bold text-[#2d211b] sm:text-4xl">
                  A closer look at our collections
                </h2>

                <p className="mt-2 text-stone-600">
                  Explore the styles and essentials our sellers bring together.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  category: 'Fashion',
                  image:
                    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=85',
                  label: 'Everyday, elevated',
                },
                {
                  category: 'Home & Living',
                  image:
                    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85',
                  label: 'Make room for good living',
                },
                {
                  category: 'Electronics',
                  image:
                    'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=85',
                  label: 'Useful things, beautifully found',
                },
              ].map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setCategory(item.category)
                    document.getElementById('products')?.scrollIntoView({
                      behavior: 'smooth',
                    })
                  }}
                  className="group relative isolate min-h-64 overflow-hidden rounded-[1.5rem] bg-[#2d211b] text-left text-white"
                >
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

                  <span className="absolute bottom-0 p-6">
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#f4d2a3]">
                      {item.category}
                    </span>

                    <span className="mt-2 block font-serif text-2xl font-bold">
                      {item.label}
                    </span>

                    <span className="mt-4 inline-block text-sm font-bold">
                      Browse collection <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section id="products" className="scroll-mt-8 py-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.22em] text-[#a85327]">
                  INDEPENDENT FINDS
                </p>

                <h2 className="mt-2 font-serif text-3xl font-bold text-[#2d211b] sm:text-4xl">
                  Explore the marketplace
                </h2>

                <p className="mt-2 text-sm text-stone-600">
                  {filteredProducts.length} products available
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="product-sort"
                  className="text-sm font-medium text-stone-600"
                >
                  Sort by
                </label>

                <select
                  id="product-sort"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as typeof sortOrder)
                  }
                  className="rounded-full border border-[#dfd6ca] bg-[#fbf9f5] px-4 py-2.5 text-sm text-[#2d211b] outline-none focus:border-[#a85327]"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                </select>

                {category !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setCategory('All')}
                    className="rounded-full border border-[#dfd6ca] px-4 py-2.5 text-sm font-semibold text-[#8e421f] transition hover:bg-[#f4e7d8]"
                  >
                    Clear category
                  </button>
                )}
              </div>
            </div>

            {loading && (
              <p className="py-12 text-center text-gray-500">
                Loading products...
              </p>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 p-5 text-red-700">
                {error}

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="ml-3 font-bold underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredProducts.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-12 text-center">
                <p className="text-4xl">🔎</p>

                <h3 className="mt-4 text-xl font-bold">No products found</h3>

                <p className="mt-2 text-gray-500">
                  Try another search or category.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setCategory('All')
                  }}
                  className="mt-5 rounded-lg bg-orange-600 px-5 py-3 font-bold text-white"
                >
                  Show all products
                </button>
              </div>
            )}

            {!loading && !error && filteredProducts.length > 0 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-[1.5rem] border border-[#e7dfd4] bg-[#fbf9f5] transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#3a2618]/10"
                  >
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="relative block w-full overflow-hidden bg-[#eee8df] text-left"
                      aria-label={`View ${product.name}`}
                    >
                      <img
                        src={productImage(product.category)}
                        alt={`${product.category} collection illustration`}
                        loading="lazy"
                        className="h-56 w-full object-cover transition duration-500 hover:scale-105"
                      />

                      <span className="absolute bottom-3 left-3 rounded-full bg-[#211711]/75 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                        Category illustration
                      </span>
                    </button>

                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#a85327]">
                        {product.category}
                      </p>

                      <h3 className="mt-2 min-h-12 font-serif text-lg font-bold leading-6 text-[#2d211b]">
                        {product.name}
                      </h3>

                      <p className="mt-3 text-xl font-extrabold text-[#2d211b]">
                        {formatPrice(product.price)}
                      </p>

                      <p
                        className={`mt-2 text-sm ${
                          product.stock > 0
                            ? 'text-stone-500'
                            : 'text-red-700'
                        }`}
                      >
                        {product.stock > 0
                          ? `${product.stock} in stock`
                          : 'Out of stock'}
                      </p>

                      <button
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => openProduct(product)}
                        className="mt-4 w-full rounded-full bg-[#a85327] px-4 py-3 font-bold text-white transition hover:bg-[#88421f] disabled:cursor-not-allowed disabled:bg-stone-300"
                      >
                        {product.stock > 0 ? 'View product' : 'Out of stock'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="my-10 grid gap-5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/seller'
              }}
              className="rounded-2xl bg-orange-100 p-7 text-left transition hover:-translate-y-1 hover:bg-orange-200 md:p-10"
            >
              <p className="font-bold text-orange-700">FOR SELLERS</p>

              <h2 className="mt-3 text-2xl font-extrabold">
                Bring your business to Shopora.
              </h2>

              <p className="mt-3 text-gray-600">
                Help more customers discover your products.
              </p>

              <span className="mt-5 inline-block font-bold text-orange-700">
                Start selling on Shopora →
              </span>
            </button>

            <div className="flex flex-col justify-center rounded-2xl bg-gray-900 p-7 text-white md:p-10">
              <p className="font-bold text-orange-400">SHOP WITH EASE</p>

              <h2 className="mt-3 text-2xl font-extrabold">
                Your next favourite find is waiting.
              </h2>

              <p className="mt-3 text-gray-300">
                Explore products available from marketplace sellers.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-10 bg-gray-950 px-4 py-10 text-gray-300">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <h2 className="text-2xl font-extrabold text-orange-500">
              Shopora.
            </h2>

            <p className="mt-3 max-w-sm text-sm leading-6">
              A marketplace built to connect shoppers and sellers across Nigeria.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white">Shop</h3>

            <p className="mt-3 text-sm">
              Discover products and explore categories.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white">Marketplace</h3>

            <p className="mt-3 text-sm">
              Built for Nigeria. Prices shown in NGN.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-7xl border-t border-gray-800 pt-5 text-center text-sm">
          © {new Date().getFullYear()} Shopora. All rights reserved.
        </p>
      </footer>

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
        className="absolute inset-0 bg-black/40"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-extrabold">
            Your cart ({cartCount})
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl hover:bg-gray-100"
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-5xl">🛒</p>

              <h3 className="mt-4 font-bold">Your cart is empty</h3>

              <p className="mt-2 text-sm text-gray-500">
                Add a product to get started.
              </p>

              <button
                type="button"
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
                  className="border-b border-gray-100 pb-5"
                >
                  <div className="flex gap-3">
                    <img
                      src={productImage(item.product.category)}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover"
                    />

                    <div>
                      <h3 className="font-bold">
                        {item.product.name}
                      </h3>

                      <p className="mt-1 text-orange-600">
                        {formatPrice(item.product.price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeQuantity(item.product.id, -1)
                      }
                      className="rounded-lg border px-3 py-1"
                      aria-label={`Remove one ${item.product.name}`}
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      type="button"
                      onClick={() =>
                        onChangeQuantity(item.product.id, 1)
                      }
                      disabled={item.quantity >= item.product.stock}
                      className="rounded-lg border px-3 py-1 disabled:opacity-40"
                      aria-label={`Add one ${item.product.name}`}
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(item.product.id)}
                      className="ml-auto text-sm text-red-600"
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
            <div className="mb-4 flex justify-between text-lg font-extrabold">
              <span>Subtotal</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>

            <p className="mb-4 text-xs leading-5 text-gray-500">
              Checkout and payment are not yet connected to the backend.
            </p>

            <button
              type="button"
              onClick={() =>
                window.alert(
                  'Checkout is not connected yet. Your cart is saved in this browser.',
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