const DEFAULT_API_URL = 'https://shopora-backend-ng.onrender.com'

export const API_URL =
  import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL