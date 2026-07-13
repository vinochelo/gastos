export function getApiUrl(path: string): string {
  const isCapacitor = typeof window !== 'undefined' && (
    (window as any).Capacitor || 
    window.location.protocol === 'file:' || 
    (window.location.hostname === 'localhost' && !window.location.port)
  );
  const base = isCapacitor ? 'https://gastos-delta-pearl.vercel.app' : '';
  return `${base}${path}`;
}
