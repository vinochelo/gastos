import { auth } from "@/lib/firebase";

export function getApiUrl(path: string): string {
  const isCapacitor = typeof window !== 'undefined' && (
    Boolean((window as Window & { Capacitor?: unknown }).Capacitor) || 
    window.location.protocol === 'file:' || 
    (window.location.hostname === 'localhost' && !window.location.port)
  );
  const base = isCapacitor ? 'https://gastos-delta-pearl.vercel.app' : '';
  return `${base}${path}`;
}

/**
 * Performs a fetch request to an internal API route with the current user's Firebase ID token.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(getApiUrl(path), {
    ...init,
    headers,
  });
}
