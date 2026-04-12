const runtimeApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = runtimeApiBase
  ? runtimeApiBase.replace(/\/+$/, "")
  : "";

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
