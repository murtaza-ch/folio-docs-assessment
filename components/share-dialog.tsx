"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { LockKeyhole, X } from "lucide-react";
import type { Document, DocumentShare, ShareRole, User } from "@/lib/types";
import { InlineAlert, Spinner } from "./feedback";
import { Modal } from "./modal";
import { SelectField } from "./select-field";
import "./dialogs.css";

const ROLE_OPTIONS: { value: ShareRole; label: string }[] = [
  { value: "viewer", label: "Can view" },
  { value: "editor", label: "Can edit" },
];

/** `"invite"` while inviting, otherwise the id of the person being changed. */
type Pending = "invite" | string | null;

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
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");
  const busy = pending !== null;
  const ids = {
    person: useId(),
    role: useId(),
    email: useId(),
    access: useId(),
  };
  const sharesPath = `/api/documents/${document.id}/shares`;

  const load = useCallback(async () => {
    const response = await fetch(sharesPath);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not load sharing settings.");
    setShares(data.shares);
    setUsers(data.users);
  }, [sharesPath]);

  useEffect(() => {
    load()
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function changeAccess(
    target: Exclude<Pending, null>,
    path: string,
    init: RequestInit,
  ) {
    setPending(target);
    setError("");
    try {
      const response = await fetch(path, init);
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
      setPending(null);
    }
  }
  function grant(target: Exclude<Pending, null>, body: object) {
    return changeAccess(target, sharesPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inviteEmail = email.trim();
    if (busy || (!selected && !inviteEmail)) return;
    void grant(
      "invite",
      inviteEmail ? { email: inviteEmail, role } : { userId: selected, role },
    );
  }
  function revoke(userId: string) {
    void changeAccess(userId, `${sharesPath}/${userId}`, { method: "DELETE" });
  }

  const available = users.filter(
    (user) =>
      user.id !== document.ownerId &&
      !shares.some((share) => share.userId === user.id),
  );
  const canInvite = Boolean(selected || email.trim());

  return (
    <Modal
      title={`Share “${document.title || "Untitled document"}”`}
      closeDisabled={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Done
        </button>
      }
    >
      <form className="share-invite" onSubmit={invite}>
        <div className="share-invite-row">
          <label className="visually-hidden" htmlFor={ids.person}>
            Person to invite
          </label>
          <SelectField
            id={ids.person}
            className="share-person-select"
            label="Person to invite"
            insideDialog
            options={available.map((user) => ({
              value: user.id,
              label: `${user.name} · ${user.email}`,
            }))}
            placeholder={
              loading
                ? "Loading people…"
                : available.length
                  ? "Choose a person"
                  : "No one else to suggest"
            }
            value={selected}
            onChange={(value) => {
              setSelected(value);
              setEmail("");
            }}
            disabled={loading || busy || available.length === 0}
          />
          <label className="visually-hidden" htmlFor={ids.role}>
            Permission for the invited person
          </label>
          <RoleSelect
            id={ids.role}
            value={role}
            onChange={setRole}
            disabled={busy}
          />
          <button
            type="submit"
            className="btn btn-primary share-invite-submit"
            disabled={!canInvite || busy}
          >
            {pending === "invite" && <Spinner />}
            {pending === "invite" ? "Inviting…" : "Invite"}
          </button>
        </div>
        <label className="share-email" htmlFor={ids.email}>
          <span>Or invite a registered account by email</span>
          <input
            id={ids.email}
            className="field"
            type="email"
            autoComplete="off"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSelected("");
            }}
            disabled={busy}
          />
        </label>
      </form>

      {error && <InlineAlert>{error}</InlineAlert>}

      <section className="share-access" aria-labelledby={ids.access}>
        <h3 id={ids.access} className="share-section-title">
          People with access
        </h3>
        <ul className="share-people" aria-busy={loading}>
          <PersonRow person={document.owner}>
            <span className="share-owner-label">Owner</span>
          </PersonRow>
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            shares.map((share) => (
              <PersonRow key={share.userId} person={share.user}>
                <RoleSelect
                  compact
                  aria-label={`Access for ${share.user.name}`}
                  value={share.role}
                  onChange={(nextRole) =>
                    grant(share.userId, {
                      userId: share.userId,
                      role: nextRole,
                    })
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label={`Remove ${share.user.name}'s access`}
                  title="Remove access"
                  disabled={busy}
                  onClick={() => revoke(share.userId)}
                >
                  {pending === share.userId ? <Spinner /> : <X size={16} />}
                </button>
              </PersonRow>
            ))
          )}
        </ul>
      </section>

      <p className="share-note">
        <LockKeyhole size={14} aria-hidden />
        Only people listed here can open this document. Viewers can read and
        comment; editors can also edit and restore versions.
      </p>
    </Modal>
  );
}

function RoleSelect({
  value,
  onChange,
  compact = false,
  ...props
}: {
  value: ShareRole;
  onChange: (role: ShareRole) => void;
  compact?: boolean;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <SelectField
      id={props.id}
      disabled={props.disabled}
      label={props["aria-label"] ?? "Permission for the invited person"}
      className={`share-role-select${compact ? " is-compact" : ""}`}
      insideDialog
      options={ROLE_OPTIONS}
      value={value}
      onChange={(next) => onChange(next as ShareRole)}
    />
  );
}

function PersonRow({
  person,
  children,
}: {
  person: User;
  children: ReactNode;
}) {
  return (
    <li className="share-person">
      <span className="avatar" style={{ background: person.color }} aria-hidden>
        {person.initials}
      </span>
      <div className="share-person-text">
        <strong>{person.name}</strong>
        <span>{person.email}</span>
      </div>
      <div className="share-person-actions">{children}</div>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="share-person is-skeleton" aria-hidden>
      <span className="avatar skeleton" />
      <div className="share-person-text">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line is-short" />
      </div>
    </li>
  );
}
