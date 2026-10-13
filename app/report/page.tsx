import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import "./report.css";

export const metadata: Metadata = {
  title: "Assessment report | Folio",
  description:
    "Implementation, architecture, verification and scope of the Folio document workspace.",
};

export default function ReportPage() {
  // Render only this reviewed, version-controlled file. No database or user input.
  const markdown = readFileSync(join(process.cwd(), "SUBMISSION.md"), "utf8");
  const html = marked.parse(markdown, { async: false });

  return (
    <div className="report">
      <header className="report-nav">
        <a href="/" className="report-brand">
          Folio
        </a>
        <nav aria-label="Report links">
          <a href="/">Open app</a>
          <a href="https://github.com/murtaza-ch/folio-docs-assessment">
            Source
          </a>
          <a href="https://github.com/murtaza-ch/folio-docs-assessment/blob/main/SUBMISSION.md">
            Markdown
          </a>
        </nav>
      </header>
      <main className="report-main">
        <p className="report-kicker">
          Implementation · Architecture · Verification
        </p>
        <article
          className="report-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
}
