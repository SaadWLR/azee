/**
 * Minimal HTTP client for the future market-data backend.
 *
 * Services currently resolve local fixtures through mockResponse().
 * Switching a service to live data means replacing its mockResponse
 * call with apiGet<T>() for the same payload type — consumers and
 * hooks stay untouched.
 */

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `GET ${path} failed with status ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Wraps a fixture in a resolved promise so mock services share the
 * exact call shape of apiGet.
 */
export function mockResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}
