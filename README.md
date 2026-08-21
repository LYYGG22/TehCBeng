# IntelliHub — AI-Assisted Fraud Investigation Platform

IntelliHub is a fraud case management dashboard for a support/investigations team. It combines a case/transaction/policy tracker with an AI chatbot that answers questions using retrieval-augmented generation (RAG) over the team's own cases, policies, transactions, and internal documents (PDF/Word/Excel) — with role-based access control enforced at retrieval time, not just in the UI.

## Quick Start

### Prerequisites

- **PHP 8.0+** with the `pdo_sqlite` extension enabled (bundled with most PHP installs)
- **Composer** (for the PDF/Word/Excel parsing libraries)
- A modern browser
- Internet access (for the AI chatbot's model calls and the Markdown-rendering CDN script)

### Setup

```bash
composer install
```

This installs the three PHP libraries used to parse uploaded documents (see [Dependencies](#dependencies) below).

Then set up the chatbot's API key:

```bash
cp .env.example .env
```

**Why this step is needed:** `.env` is the file the app actually reads, but it's gitignored on purpose so a real secret key never gets committed to the repo — so a fresh clone never has one, even though it has `.env.example`. This command just creates your local `.env` from that template. Skip it and the chatbot will show `OPENROUTER_API_KEY is not set`.

`.env.example` has a working OpenRouter key pre-filled for judging/evaluation, so the chatbot works immediately with no account needed. **This key is disposable and will be revoked after the competition** — if you're using this project past judging, replace it in `.env` with your own key from [openrouter.ai](https://openrouter.ai/settings/integrations).

The database is **created automatically** on first request — `Logic/db.php` builds a SQLite file at `Data/app.db`, creates the schema, and seeds it from the JSON files in `Data/`. There is no separate migration step.

### Run

From the repository root:

```bash
php -S localhost:8000
```

Then open:

```
http://localhost:8000/Interface/login.html
```

### Demo logins

| Role    | Email                      | Password    |
|---------|-----------------------------|-------------|
| Manager | manager@intellihub.com      | manager123  |
| Staff   | staff@intellihub.com        | staff123    |

Manager and Staff see different data/features (e.g. Process Insights is Manager-only); use both to see the access control in action.

## What to Try (Test Plan)

1. **Log in as Staff**, browse Cases, open a case, check the Knowledge search.
2. **Ask the chatbot** a question about a fraud pattern (e.g. "how do we handle account takeover?") — it answers using retrieved cases/policies and cites its sources; click a citation to open the source document.
3. **Log in as Manager**, visit **Process Insights** (Manager-only) to see automation candidates and policy coverage gaps derived from case history.
4. **Analysis & Report page** — generate a report and export it as **PDF** or **Excel** from the format dropdown next to the Export button.
5. **Permission check**: ask the chatbot the same question as Staff and as Manager where a source document is internally marked `Access: Manager` (see `Data/Documents/device_verification_guide.docx`) — Staff gets no answer from that source, Manager does.

## Architecture Notes

### Layout

```
Interface/        Frontend — one PHP page per view (dashboard.php, cases.php, reports.php, …),
                   sharing a header/footer via Interface/partials/chrome_head.php and chrome_foot.php.
                   Interface/assets/ holds the page-specific JS (assets/pages/*.js) plus
                   shared helpers (common.js, shared-analytics.js).
Logic/             Backend — plain PHP endpoints (no framework), one file per concern:
                   auth.php, data.php, chatbot.php, document.php, case_actions.php, db.php.
Data/               Source-of-truth JSON (fraud_cases.json, policies.json, transactions.json),
                   the raw source documents (Data/Documents/), the generated document text
                   cache (documents_cache.json), and the generated SQLite DB (app.db, gitignored).
vendor/             Composer dependencies (gitignored).
```

This is a **multi-page PHP app**, not a single-page app — each view is its own `.php` file and reloads the page on navigation. (There is also a `dashboard.html` + `assets/app.js` — an earlier single-page prototype that predates the current multi-page structure. It's no longer linked from anywhere and isn't the live app; safe to ignore or delete.)

### Data flow

- `Data/*.json` are the files you actually hand-edit. On **every request**, `db.php` re-syncs their contents into the SQLite tables (`cases`, `policies`, `transactions`, `company_documents`) — so there's no separate "rebuild the DB" step when you edit a JSON file.
- **Documents** (PDF/Word/Excel dropped into `Data/Documents/`) are different: they're binary files, so they go through a one-time extraction step. Run:
  ```bash
  php Logic/extract_documents.php
  ```
  This parses each file's text (via `smalot/pdfparser`, `phpoffice/phpword`, `phpoffice/phpspreadsheet`) into `Data/documents_cache.json`, which `db.php` then syncs like the other JSON sources. **New or changed files in `Data/Documents/` won't appear anywhere in the app — chatbot answers, document viewer, etc. — until this script is re-run.**

### Permission-aware retrieval

Every record (case, policy, transaction, document) can carry an `access_level` field (lowercase role name, e.g. `"manager"`; absent/`null` = visible to everyone). `Logic/retrieve_data.php`'s `canAccessDocument()` enforces this **before** anything reaches the AI's context or the Knowledge search results — a restricted record is filtered out at retrieval time, not hidden client-side.

For documents extracted from `Data/Documents/`, `extract_documents.php` looks for an inline `Access: <Role>` marker in the document's own text (see `device_verification_guide.docx`) and maps it to the same `access_level` convention automatically.

### AI Chatbot

`Logic/chatbot.php` does simple keyword-based retrieval (`retrieveRelevant()` in `retrieve_data.php`) over cases/policies/transactions/documents, filters by the current user's role, then sends the top matches as context to an LLM (via OpenRouter) to produce a grounded, cited answer. This is intentionally lightweight (no vector DB/embeddings) — appropriate for the dataset size here.

### Report export

The Analysis & Report page's PDF and Excel export are generated **entirely client-side** in `Interface/assets/pages/reports.js` — the PDF is a hand-built minimal PDF document (no library), and the Excel file is SpreadsheetML XML that Excel opens natively. No server round-trip is needed to export.

## Dependencies

| Package | Purpose |
|---|---|
| `smalot/pdfparser` | Extracts text from `.pdf` source documents |
| `phpoffice/phpword` | Extracts text from `.docx` source documents |
| `phpoffice/phpspreadsheet` | Extracts text from `.xlsx` source documents |
| `marked.js` (CDN, `cdnjs.cloudflare.com`) | Renders the chatbot's Markdown-formatted answers in the browser |
