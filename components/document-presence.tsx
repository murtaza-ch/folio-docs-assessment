"use client";

import { useEffect, useRef, useState } from "react";
import type { PresenceSnapshot } from "@/lib/presence-types";
import "./presence.css";

interface Props {
  documentId: string;
  currentUserId: string;
  editing: boolean;
  enabled?: boolean;
  onRemoteUpdate?: (version: number) => void;
}
export function DocumentPresence({
  documentId,
  currentUserId,
  editing,
  enabled = true,
  onRemoteUpdate,
}: Props) {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const editingRef = useRef(editing);
  const callbackRef = useRef(onRemoteUpdate);
  const beatRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    callbackRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);
  useEffect(() => {
    editingRef.current = editing;
    const timer = setTimeout(() => beatRef.current?.(), 250);
    return () => clearTimeout(timer);
  }, [editing]);

  useEffect(() => {
    if (!enabled) return;
    const tabId = crypto.randomUUID();
    const url = `/api/documents/${documentId}/presence`;
    let stopped = false;
    let denied = false;
    let reading = false;
    let writing = false;
    const controller = new AbortController();
    setSnapshot(null);
    setConnection("Connecting");
    function leave() {
      void fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId }),
        keepalive: true,
      }).catch(() => {});
    }
    async function update(method: "GET" | "POST") {
      if (
        stopped ||
        denied ||
        document.visibilityState !== "visible" ||
        (method === "GET" ? reading : writing)
      )
        return;
      if (method === "GET") reading = true;
      else writing = true;
      try {
        const response = await fetch(url, {
          method,
          signal: controller.signal,
          cache: "no-store",
          ...(method === "POST"
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tabId,
                  status: editingRef.current ? "editing" : "viewing",
                }),
              }
            : {}),
        });
        if (stopped) return;
        if ([401, 403, 404].includes(response.status)) {
          denied = true;
          setSnapshot(null);
          setConnection("Access unavailable");
          return;
        }
        if (!response.ok) throw new Error("Presence unavailable");
        const next = (await response.json()) as PresenceSnapshot;
        if (stopped || document.visibilityState !== "visible") {
          if (method === "POST") leave();
          return;
        }
        setSnapshot(next);
        setConnection("Live");
        callbackRef.current?.(next.documentVersion);
      } catch {
        if (!stopped) {
          setConnection("Reconnecting");
          setSnapshot(null);
        }
      } finally {
        if (method === "GET") reading = false;
        else writing = false;
      }
    }
    const heartbeat = () => {
      void update("POST");
    };
    beatRef.current = heartbeat;
    heartbeat();
    const poll = setInterval(() => {
      void update("GET");
    }, 3000);
    const beats = setInterval(heartbeat, 6000);
    function visibility() {
      if (document.visibilityState === "visible") {
        setConnection("Connecting");
        heartbeat();
        void update("GET");
      } else {
        leave();
        setSnapshot(null);
        setConnection("Paused");
      }
    }
    function pagehide() {
      leave();
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(poll);
      clearInterval(beats);
      beatRef.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      leave();
    };
  }, [documentId, currentUserId, enabled]);

  if (!enabled) return null;
  const participants = snapshot?.participants ?? [];
  const live = connection === "Live";
  // "Connecting" is brief on every open, so only problems are shown as text.
  const problem = !live && connection !== "Connecting";
  return (
    <div
      className="presence"
      title="Refreshes every 3 seconds; inactive sessions expire after 20 seconds."
    >
      <ul className="presence__avatars" aria-label="People in this document">
        {participants.map(({ user, status }) => {
          const label = `${user.id === currentUserId ? "You are" : `${user.name} is`} ${status}`;
          return (
            <li
              key={user.id}
              className="avatar avatar-sm presence__avatar"
              data-status={status}
              style={{ background: user.color }}
              title={label}
              aria-label={label}
            >
              {user.initials}
            </li>
          );
        })}
      </ul>
      <span
        className={problem ? "presence__status" : "visually-hidden"}
        aria-live="polite"
      >
        {live ? `${participants.length} online` : connection}
      </span>
    </div>
  );
}
