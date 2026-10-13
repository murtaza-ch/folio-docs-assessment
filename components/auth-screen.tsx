"use client";

import { useId, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import type { User } from "@/lib/types";
import { InlineAlert, Spinner } from "./feedback";
import "./auth-screen.css";

type Mode = "sign-in" | "sign-up";

const DEMO_PASSWORD = "FolioDemo!2026";
const DEMO_ACCOUNTS = [
  {
    name: "Alice Morgan",
    email: "alice@folio.demo",
    initials: "AM",
    color: "#d9e5dd",
  },
  {
    name: "Ben Carter",
    email: "ben@folio.demo",
    initials: "BC",
    color: "#e7ddf1",
  },
  {
    name: "Clara Park",
    email: "clara@folio.demo",
    initials: "CP",
    color: "#f3ddcf",
  },
];

const COPY: Record<
  Mode,
  { title: string; subtitle: string; submit: string; busy: string }
> = {
  "sign-in": {
    title: "Sign in to Folio",
    subtitle: "Use your email and password to continue.",
    submit: "Sign in",
    busy: "Signing in…",
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "Write and share documents with your team.",
    submit: "Create account",
    busy: "Creating account…",
  },
};

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ids = { name: useId(), email: useId(), password: useId() };
  const copy = COPY[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mode === "sign-up" ? { name } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to sign in. Please try again.");
      setPassword("");
      await onAuthenticated(result.user);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Could not connect. Check your connection and try again."
          : cause instanceof Error
            ? cause.message
            : "Unable to connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode() {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setError("");
    setPassword("");
  }

  return (
    <main className="auth">
      <div className="auth-column">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden>
            F
          </span>
          Folio
        </div>

        <section className="auth-card" aria-labelledby="auth-title">
          <header className="auth-card-header">
            <h1 id="auth-title">{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </header>

          <form className="auth-form" onSubmit={submit}>
            {mode === "sign-up" && (
              <div className="auth-field">
                <label htmlFor={ids.name}>Name</label>
                <input
                  id={ids.name}
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  disabled={busy}
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor={ids.email}>Email</label>
              <input
                id={ids.email}
                className="field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
                placeholder="you@company.com"
              />
            </div>
            <PasswordField
              id={ids.password}
              mode={mode}
              value={password}
              onChange={setPassword}
              disabled={busy}
            />
            {error && <InlineAlert>{error}</InlineAlert>}
            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit"
              disabled={busy}
            >
              {busy && <Spinner />}
              {busy ? copy.busy : copy.submit}
            </button>
          </form>

          {mode === "sign-in" && (
            <DemoAccounts
              selectedEmail={email}
              disabled={busy}
              onSelect={(demoEmail) => {
                setEmail(demoEmail);
                setPassword(DEMO_PASSWORD);
                setError("");
              }}
            />
          )}
        </section>

        <p className="auth-switch">
          {mode === "sign-in"
            ? "Don’t have an account?"
            : "Already have an account?"}{" "}
          <button type="button" disabled={busy} onClick={switchMode}>
            {mode === "sign-in" ? "Create one" : "Sign in"}
          </button>
        </p>
        <p className="auth-footnote">
          <LockKeyhole size={13} aria-hidden />
          Documents are private until you share them.
        </p>
      </div>
    </main>
  );
}

function PasswordField({
  id,
  mode,
  value,
  onChange,
  disabled,
}: {
  id: string;
  mode: Mode;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = `${id}-hint`;
  const isNew = mode === "sign-up";
  return (
    <div className="auth-field">
      <label htmlFor={id}>Password</label>
      <div className="auth-password">
        <input
          id={id}
          className="field"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={isNew ? "new-password" : "current-password"}
          required
          minLength={isNew ? 8 : 1}
          maxLength={128}
          disabled={disabled}
          aria-describedby={isNew ? hintId : undefined}
        />
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          disabled={disabled}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {isNew && (
        <p id={hintId} className="auth-hint">
          At least 8 characters.
        </p>
      )}
    </div>
  );
}

function DemoAccounts({
  selectedEmail,
  disabled,
  onSelect,
}: {
  selectedEmail: string;
  disabled: boolean;
  onSelect: (email: string) => void;
}) {
  return (
    <section className="auth-demo" aria-labelledby="auth-demo-title">
      <h2 id="auth-demo-title" className="auth-divider">
        <span>or use a demo account</span>
      </h2>
      <ul className="auth-demo-list">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              className="auth-demo-account"
              aria-pressed={selectedEmail === account.email}
              disabled={disabled}
              onClick={() => onSelect(account.email)}
            >
              <span
                className="avatar"
                style={{ background: account.color }}
                aria-hidden
              >
                {account.initials}
              </span>
              <span className="auth-demo-text">
                <strong>{account.name}</strong>
                <span>{account.email}</span>
              </span>
              <span className="auth-demo-action" aria-hidden>
                Use
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="auth-demo-password">
        Password for all demo accounts <kbd>{DEMO_PASSWORD}</kbd>
      </p>
    </section>
  );
}
