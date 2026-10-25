// Small wrapper around fetch() for the EcoTrack API.
// Throws an Error with a readable message when the server says no.

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new Error("Could not reach the EcoTrack server. Is it running?");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(data, response.status));
  return data;
}

// FastAPI returns 422 errors as a list: [{loc: [...,"field"], msg: "..."}]
function readError(data, status) {
  const detail = data && data.detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = (first.loc || []).filter((p) => p !== "body").join(".");
    const msg = String(first.msg || "Invalid value").replace(/^Value error, /, "");
    return field ? `${field.replace(/_/g, " ")}: ${msg}` : msg;
  }
  if (typeof detail === "string") return detail;
  return `Request failed (${status})`;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
};