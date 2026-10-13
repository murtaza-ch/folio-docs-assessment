import { useCallback, useEffect, useState } from "react";
import type { DocumentComment } from "@/lib/collaboration-types";
import { jsonBody, requestJson } from "./request";

export type CommentChange = { body?: string; resolved?: boolean };

/** Comment data for one document. Loads whenever `active` becomes true. */
export function useComments(
  documentPath: string,
  active: boolean,
  setError: (message: string) => void,
) {
  const path = `${documentPath}/comments`;
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setLoading(true);
    setError("");
    requestJson<{ comments: DocumentComment[] }>(path)
      .then((result) => {
        if (current) setComments(result.comments);
      })
      .catch((cause) => {
        if (current) setError(cause.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, active, setError]);

  const reload = useCallback(async () => {
    const result = await requestJson<{ comments: DocumentComment[] }>(path);
    setComments(result.comments);
  }, [path]);

  return {
    comments,
    loading,
    reload,
    create: (body: string) =>
      requestJson(path, { method: "POST", ...jsonBody({ body }) }),
    update: (id: string, change: CommentChange) =>
      requestJson(`${path}/${id}`, { method: "PATCH", ...jsonBody(change) }),
    remove: (id: string) => requestJson(`${path}/${id}`, { method: "DELETE" }),
  };
}

export type CommentsData = ReturnType<typeof useComments>;
