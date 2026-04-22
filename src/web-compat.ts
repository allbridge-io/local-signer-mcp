let compatLoaded = false;

export async function ensureWebApis(): Promise<void> {
  if (compatLoaded) {
    return;
  }

  if (
    typeof globalThis.fetch === 'function' &&
    typeof globalThis.Request === 'function' &&
    typeof globalThis.Response === 'function' &&
    typeof globalThis.Headers === 'function'
  ) {
    compatLoaded = true;
    return;
  }

  const {
    fetch,
    FormData,
    Headers,
    Request,
    Response,
  } = await import('undici');

  if (typeof globalThis.fetch !== 'function') {
    globalThis.fetch = fetch;
  }
  if (typeof globalThis.FormData !== 'function') {
    globalThis.FormData = FormData;
  }
  if (typeof globalThis.Headers !== 'function') {
    globalThis.Headers = Headers;
  }
  if (typeof globalThis.Request !== 'function') {
    globalThis.Request = Request;
  }
  if (typeof globalThis.Response !== 'function') {
    globalThis.Response = Response;
  }

  compatLoaded = true;
}
