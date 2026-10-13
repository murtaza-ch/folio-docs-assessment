"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { LockKeyhole, Trash2 } from "lucide-react";
import type { Document, DocumentShare, ShareRole, User } from "@/lib/types";
import { Modal } from "./modal";

export function ShareDialog({
  document,
  onClose,
  onChanged,
}: {
  document: Document;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch(`/api/documents/${document.id}/shares`);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not load sharing settings.");
    setShares(data.shares);
    setUsers(data.users);
  }
  useEffect(() => {
    load()
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function update(
    userId: string,
    nextRole?: ShareRole,
    inviteEmail?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/documents/${document.id}/shares${nextRole ? "" : `/${userId}`}`,
        {
          method: nextRole ? "POST" : "DELETE",
          ...(nextRole
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...(inviteEmail ? { email: inviteEmail } : { userId }),
                  role: nextRole,
                }),
              }
            : {}),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not update access.");
      }
      await load();
      setSelected("");
      setEmail("");
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update access.",
      );
    } finally {
      setBusy(false);
    }
  }
  const available = users.filter(
    (user) =>
      user.id !== document.ownerId &&
      !shares.some((share) => share.userId === user.id),
  );
  return (
    <Modal
      title="Share this document"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        Invite someone to{" "}
        <strong>{document.title || "Untitled document"}</strong>.
      </p>
      <div className="share-invite">
        <label className="visually-hidden" htmlFor="share-user">
          Person to invite
        </label>
        <select
          id="share-user"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setEmail("");
          }}
          disabled={loading || busy}
        >
          <option value="">Choose a person</option>
          {available.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {user.email}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="share-role">
          Invite permission
        </label>
        <select
          id="share-role"
          value={role}
          onChange={(event) => setRole(event.target.value as ShareRole)}
          disabled={busy}
        >
          <option value="viewer">Can view</option>
          <option value="editor">Can edit</option>
        </select>
      </div>
      <label className="share-email-label" htmlFor="share-email">
        Or invite a registered account by email
      </label>
      <Input
        id="share-email"
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setSelected("");
        }}
        disabled={busy}
      />
      <Button
        className="primary-button invite-button"
        onClick={() => update(selected, role, email.trim() || undefined)}
        disabled={(!selected && !email.trim()) || busy}
      >
        {busy ? "Updating access..." : "Invite person"}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <h3 className="small-heading">People with access</h3>
      <div className="share-person">
        <span className="avatar" style={{ background: document.owner.color }}>
          {document.owner.initials}
        </span>
        <div>
          <strong>{document.owner.name}</strong>
          <span>{document.owner.email}</span>
        </div>
        <span className="access-label">Owner</span>
      </div>
      {loading ? (
        <p className="loading-copy" role="status">
          Loading access...
        </p>
      ) : (
        shares.map((share) => (
          <div className="share-person" key={share.userId}>
            <span className="avatar" style={{ background: share.user.color }}>
              {share.user.initials}
            </span>
            <div>
              <strong>{share.user.name}</strong>
              <span>{share.user.email}</span>
            </div>
            <select
              aria-label={`Access for ${share.user.name}`}
              value={share.role}
              onChange={(event) =>
                update(share.userId, event.target.value as ShareRole)
              }
              disabled={busy}
            >
              <option value="viewer">Can view</option>
              <option value="editor">Can edit</option>
            </select>
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Remove ${share.user.name}'s access`}
              disabled={busy}
              onClick={() => update(share.userId)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))
      )}
      <div className="sharing-note">
        <LockKeyhole size={16} />
        <div>
          <strong>Only invited people have access</strong>
          <p>
            Viewers can read and comment. Editors can write and restore
            versions. You manage sharing.
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
