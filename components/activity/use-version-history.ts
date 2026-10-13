import { useCallback, useEffect, useRef, useState } from "react";
import type { Document } from "@/lib/types";
import type {
  VersionSnapshot,
  VersionSummary,
} from "@/lib/collaboration-types";
import { jsonBody, requestJson } from "./request";

/** Version list, previews and restore for one document. */
export function useVersionHistory(
  documentPath: string,
  initialVersion: number,
  active: boolean,
  setError: (message: string) => void,
) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<VersionSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Only the most recent preview request may update state.
  const previewRequest = useRef(0);

  useEffect(() => {
    previewRequest.current += 1;
    setSnapshot(null);
    setPreviewLoading(false);
  }, [documentPath]);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setLoading(true);
    setError("");
    requestJson<{ versions: VersionSummary[]; currentVersion: number }>(
      `${documentPath}/versions`,
    )
      .then((result) => {
        if (!current) return;
        setVersions(result.versions);
        setCurrentVersion(result.currentVersion);
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
  }, [documentPath, active, setError]);

  const preview = useCallback(
    async (version: number) => {
      const sequence = ++previewRequest.current;
      setPreviewLoading(true);
      setError("");
      try {
        const result = await requestJson<{ snapshot: VersionSnapshot }>(
          `${documentPath}/versions/${version}`,
        );
        if (sequence === previewRequest.current) setSnapshot(result.snapshot);
      } catch (cause) {
        if (sequence === previewRequest.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not open this version.",
          );
      } finally {
        if (sequence === previewRequest.current) setPreviewLoading(false);
      }
    },
    [documentPath, setError],
  );

  /** Restores against the latest saved version so concurrent edits are detected. */
  async function restore(version: number) {
    const latest = await requestJson<{ document: Document }>(documentPath);
    const restored = await requestJson<{ document: Document }>(
      `${documentPath}/versions/${version}/restore`,
      { method: "POST", ...jsonBody({ version: latest.document.version }) },
    );
    return restored.document;
  }

  return {
    versions,
    currentVersion,
    loading,
    snapshot,
    previewLoading,
    preview,
    restore,
  };
}

export type VersionHistoryData = ReturnType<typeof useVersionHistory>;
