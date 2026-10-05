import type { ChatMessage, DocumentInfo } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (!token) throw new UnauthorizedError();
  return { Authorization: `Bearer ${token}` };
}

/** Pulls the server's `{ error }` message out of a failed response. */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* non-JSON body */
  }
  return fallback;
}

export async function fetchHistory(): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
    headers: authHeaders(),
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error("Failed to fetch history");
  return response.json();
}

export function openChatStream(message: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message }),
    signal,
  });
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: authHeaders(),
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(await errorMessage(response, "Failed to load documents"));
  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/documents`, {
    method: "POST",
    headers: authHeaders(), // no Content-Type: the browser sets the multipart boundary
    body: form,
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Upload failed"));
  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Delete failed"));
}
