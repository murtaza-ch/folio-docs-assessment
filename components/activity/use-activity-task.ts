import { useCallback, useState } from "react";

export interface ActivityTask {
  busy: boolean;
  error: string;
  setError: (message: string) => void;
  /** Runs one mutation at a time and resolves to whether it succeeded. */
  run: (task: () => Promise<void>) => Promise<boolean>;
}

export function useActivityTask(): ActivityTask {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (busy) return false;
      setBusy(true);
      setError("");
      try {
        await task();
        return true;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not complete this action.",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, error, setError, run };
}
