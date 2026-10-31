export const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  `http://${window.location.hostname}:8001`