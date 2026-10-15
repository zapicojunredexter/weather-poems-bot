// fetch() with a hard timeout, so a slow API can never leave the script hanging.
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
