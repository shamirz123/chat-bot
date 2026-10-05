"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import { deleteDocument, listDocuments, uploadDocument } from "../lib/api";
import type { DocumentInfo } from "../lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

/** Sidebar section for the knowledge base: the shared CV plus the user's uploads. */
export default function DocumentsPanel() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("File is too large (max 5 MB).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await uploadDocument(file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <section className="border-t border-line p-4" aria-label="Documents">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Documents</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          <FiPlus />
          {uploading ? "Indexing…" : "Add"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={onFile}
          aria-label="Upload a document"
        />
      </div>

      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-page"
          >
            <FiFileText className="shrink-0 text-muted" />
            <span className="flex-1 truncate" title={doc.name}>
              {doc.name}
            </span>
            {doc.kind === "cv" ? (
              <span className="text-xs text-muted">shared</span>
            ) : (
              <button
                type="button"
                onClick={() => remove(doc.id)}
                aria-label={`Delete ${doc.name}`}
                className="text-muted hover:text-danger md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
              >
                <FiTrash2 />
              </button>
            )}
          </li>
        ))}
        {docs.length === 0 && <li className="px-2 text-xs text-muted">No documents yet.</li>}
      </ul>

      <p className="mt-2 px-2 text-xs leading-snug text-muted">
        PDF, TXT or MD, up to 5 MB. Answers cite their sources.
      </p>
      {error && (
        <p role="alert" className="mt-2 px-2 text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
