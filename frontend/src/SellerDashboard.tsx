import { useEffect, useState } from 'react'
import { API_URL } from './api'

type Product = {
  id: number
  name: string
  price: number
  category: string
  stock: number
}

type ProductDraft = {
  name: string
  price: string
  category: string
  stock: string
}

const emptyDraft: ProductDraft = {
  name: '',
  price: '',
  category: '',
  stock: '',
}

function SellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [search, setSearch] = useState('')
  const sellerName = localStorage.getItem('shopora_seller_name') || 'Seller'
  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )

  useEffect(() => {
    const token = localStorage.getItem('shopora_seller_token')
    if (!token) {
      window.location.replace('/seller?mode=login')
      return
    }

    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/seller/products`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(
            typeof result.detail === 'string'
              ? result.detail
              : 'Unable to load your products.',
          )
        }

        setProducts((await response.json()) as Product[])
      } catch (requestError) {
        setError(
          requestError instanceof TypeError
            ? 'Cannot connect to the backend. Make sure the server is running on port 8001.'
            : requestError instanceof Error
              ? requestError.message
              : 'Unable to load your products.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadProducts()
  }, [])

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError('')
    setSuccess('')

    const token = localStorage.getItem('shopora_seller_token')
    if (!token) {
      window.location.replace('/seller?mode=login')
      return
    }

    setCreating(true)
    try {
      const response = await fetch(`${API_URL}/seller/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: draft.name.trim(),
          price: Number(draft.price),
          category: draft.category.trim(),
          stock: Number(draft.stock),
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Could not create the product. Please try again.',
        )
      }

      const product = result as Product
      setProducts((current) => [product, ...current])
      setDraft(emptyDraft)
      setSuccess(`${product.name} was added to your shop.`)
    } catch (requestError) {
      setCreateError(
        requestError instanceof TypeError
          ? 'Cannot connect to the backend. Make sure the server is running on port 8001.'
          : requestError instanceof Error
            ? requestError.message
            : 'Could not create the product.',
      )
    } finally {
      setCreating(false)
    }
  }

  function signOut() {
    localStorage.removeItem('shopora_seller_token')
    localStorage.removeItem('shopora_seller_name')
    window.location.href = '/seller?mode=login'
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="text-2xl font-black tracking-tight text-orange-600">
            Shopora<span className="text-stone-900">.</span>
          </a>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:border-orange-200 hover:text-orange-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <section className="rounded-[2rem] bg-stone-900 p-8 text-white shadow-xl shadow-stone-900/10 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
            Seller dashboard
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Welcome, {sellerName}.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-stone-300">
            Your Shopora seller account is ready. Here is a look at the products
            currently listed in your shop.
          </p>
        </section>

        <section className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                Your shop
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Products
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-600">
                {products.length} listed
              </span>
              <input
                type="search"
                aria-label="Search your products"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-44 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500 sm:w-56"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-12 text-center text-sm text-stone-500">Loading your products...</p>
          ) : !error && products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
              <p className="text-lg font-bold">Your shop is ready for its first product.</p>
              <p className="mt-2 text-sm text-stone-500">
                You do not have any products listed yet.
              </p>
            </div>
          ) : !error && visibleProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">
              No products match “{search}”.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-4 font-semibold">{product.name}</td>
                      <td className="px-4 py-4 text-stone-600">{product.category}</td>
                      <td className="px-4 py-4 text-stone-600">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                          maximumFractionDigits: 0,
                        }).format(product.price)}
                      </td>
                      <td className="px-4 py-4 text-stone-600">{product.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              Grow your shop
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Add a product
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Products are published to the marketplace when successfully saved.
            </p>
          </div>

          {createError && (
            <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {createError}
            </p>
          )}
          {success && (
            <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">
              {success}
            </p>
          )}

          <form onSubmit={createProduct} className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Product name
              <input
                required
                minLength={1}
                maxLength={200}
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                placeholder="e.g. Woven leather tote"
              />
            </label>

            <label className="text-sm font-semibold">
              Category
              <input
                required
                minLength={1}
                maxLength={100}
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, category: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                placeholder="e.g. Fashion"
              />
            </label>

            <label className="text-sm font-semibold">
              Price (NGN)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, price: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                placeholder="0.00"
              />
            </label>

            <label className="text-sm font-semibold">
              Stock quantity
              <input
                required
                type="number"
                min="0"
                step="1"
                value={draft.stock}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, stock: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                placeholder="0"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/15 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            >
              {creating ? 'Saving product...' : 'Add product to marketplace'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

export default SellerDashboard