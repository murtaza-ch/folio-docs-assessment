"use client";

import { useState, type FormEvent } from "react";
import { Box, Button, Input } from "@chakra-ui/react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, PenLine } from "lucide-react";
import type { User } from "@/lib/types";
import "./auth-screen.css";

const DEMO_PASSWORD = "FolioDemo!2026";
export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        cause instanceof Error
          ? cause.message
          : "Unable to connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box as="main" className="auth-page">
      <section className="auth-story">
        <a href="/" className="brand" aria-label="Folio home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          folio<span className="brand-period">.</span>
        </a>
        <div className="auth-story-copy">
          <span className="auth-kicker">A PLACE FOR SHARED WORK</span>
          <h1>
            Good work starts
            <br />
            with a thought.
          </h1>
          <p>
            Give it a place to grow. Write a draft, bring your team into the
            conversation, and keep every idea within reach.
          </p>
          <div className="auth-paper-note">
            <PenLine size={22} />
            <blockquote>
              Write something.
              <br />
              Make it better together.
            </blockquote>
            <span>YOUR NEXT CHAPTER</span>
          </div>
        </div>
        <p className="auth-story-footer">Your words. A little more room.</p>
      </section>
      <section className="auth-form-side" aria-label="Account access">
        <div className="auth-form-card">
          <span className="document-kicker">WELCOME TO FOLIO</span>
          <h2>
            {mode === "sign-in"
              ? "A space to come back to."
              : "Make room for your ideas."}
          </h2>
          <p>
            {mode === "sign-in"
              ? "Sign in to your documents and shared work."
              : "Create your account. Your workspace starts with a blank page."}
          </p>
          <form onSubmit={submit}>
            {mode === "sign-up" && (
              <label className="auth-field">
                Your name
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  disabled={busy}
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="auth-field">
              Email address
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
                placeholder="you@example.com"
              />
            </label>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "sign-up" ? 8 : 1}
                  maxLength={128}
                  disabled={busy}
                  placeholder={
                    mode === "sign-up"
                      ? "At least 8 characters"
                      : "Your password"
                  }
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="primary-button auth-submit"
              disabled={busy}
            >
              {busy
                ? "Opening your workspace..."
                : mode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-mode">
            {mode === "sign-in" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setError("");
                setPassword("");
              }}
            >
              {mode === "sign-in" ? "Create an account" : "Sign in"}
            </button>
          </p>
          {mode === "sign-in" && (
            <div className="auth-review">
              <span className="small-heading">TRY A REVIEWER ACCOUNT</span>
              <div className="auth-demo-buttons">
                {["Alice", "Ben", "Clara"].map((person) => (
                  <button
                    type="button"
                    key={person}
                    disabled={busy}
                    onClick={() => {
                      setEmail(`${person.toLowerCase()}@folio.demo`);
                      setPassword(DEMO_PASSWORD);
                      setError("");
                    }}
                  >
                    {person}
                  </button>
                ))}
              </div>
              <p>
                Choose an account to fill its login details. Reviewer password:{" "}
                <code>{DEMO_PASSWORD}</code>
              </p>
            </div>
          )}
          <div className="auth-assurance">
            <LockKeyhole size={14} />
            <span>Documents are visible to you and the people you invite.</span>
          </div>
        </div>
      </section>
    </Box>
  );
}
