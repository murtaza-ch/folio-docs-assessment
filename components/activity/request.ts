export async function requestJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not complete this action.");
  return result;
}

export function jsonBody(value: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
