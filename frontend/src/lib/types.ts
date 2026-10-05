export type ChatRole = "user" | "shamirbot" | "system" | "assistant" | string;

/** A retrieved passage the answer is grounded in (cited as [n] in the text). */
export interface Source {
  n: number;
  docName: string;
  excerpt: string;
  score: number;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  id: string;
  sources?: Source[];
}

export interface DocumentInfo {
  id: string;
  name: string;
  kind: "cv" | "upload";
  chunkCount: number;
  createdAt: string;
}

/** One server-sent event payload from POST /api/chat/stream. */
export interface SSEPayload {
  delta?: string;
  sources?: Source[];
  done?: boolean;
  error?: string;
  text?: string;
}
