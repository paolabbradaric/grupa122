export async function profileRequest(
  path = "",
  { body, csrfToken, ...options } = {},
) {
  const multipart = body instanceof FormData;
  let response;
  try {
    response = await fetch(`/api/profiles/me${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(body !== undefined && !multipart
          ? { "Content-Type": "application/json" }
          : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      ...(body !== undefined
        ? { body: multipart ? body : JSON.stringify(body) }
        : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Veza s poslužiteljem nije uspjela. Pokušaj ponovno.", {cause:error});
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Poslužitelj nije vratio valjan odgovor. Pokušaj ponovno.");
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sesija je istekla. Ponovno se prijavi."
        : data.error || "Zahtjev nije uspio.",
    );
  return data;
}
