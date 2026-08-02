# AccessLens

<p align="center">
  <img src="docs/images/accesslens-overview.svg" alt="AccessLens simplifying a public-service web form and providing a developer review console" width="100%" />
</p>

<p align="center">
  A privacy-first Chrome extension that turns complex public-service forms into a simpler, bilingual, review-before-fill experience.
</p>

AccessLens detects a supported form, loads an approved field-mapping template, and presents the same questions in a clearer interface. A user can complete the simplified form in an overlay, a step-by-step wizard, or a separate window. AccessLens fills the original page only after confirmation and never submits it automatically.

When a site has no approved template, the extension offers a website-support request instead of generating a user-side AI template. A developer can generate a draft from the request, review it, and approve it before it becomes normal site support.

> [!IMPORTANT]
> AccessLens is a prototype. The developer API currently has a placeholder authentication guard and must not be exposed publicly without real authentication and authorization.

## What it does

- Detects supported forms on `gov.lk`, local test pages, and the Selenium demo form.
- Offers all-fields and step-by-step form modes.
- Supports English and Sinhala UI text.
- Opens the simplified form in a separate window when preferred.
- Fills native inputs and dispatches the expected browser events.
- Flags low-confidence mappings for manual attention.
- Requires review before filling and leaves final submission to the user.
- Reuses approved PostgreSQL templates without an AI call.
- Generates privacy-filtered AI drafts for unknown forms and holds them for review.
- Provides a developer console for editing, validating, approving, or rejecting drafts.

## How it works

<p align="center">
  <img src="docs/images/accesslens-architecture.svg" alt="AccessLens architecture showing the website, Chrome extension, backend API, AI provider, PostgreSQL, and developer console" width="100%" />
</p>

The extension sends the backend only structural form metadata such as labels, types, required flags, options, and selectors. Personal values entered by the user remain in browser memory and are not sent to the API or stored in PostgreSQL.

<p align="center">
  <img src="docs/images/accesslens-workflow.svg" alt="AccessLens template workflow from page detection through approved template lookup, AI draft generation, developer review, and user-confirmed form filling" width="100%" />
</p>

## Tech stack

| Layer | Technology |
| --- | --- |
| Browser extension | Chrome Manifest V3, React, TypeScript, Vite, Shadow DOM |
| Backend API | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL with `pgcrypto` and row-level security enabled |
| AI template generation | Groq or OpenAI through the OpenAI-compatible SDK |

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL
- Google Chrome or another Chromium browser that can load unpacked extensions
- A Groq or OpenAI API key only if you want automatic draft generation

## Local setup

### 1. Install dependencies

```bash
npm install
cd backend
npm install
cd ..
```

### 2. Create and seed the database

Create a PostgreSQL database and run the files in this order:

```bash
psql -d accesslens -f database/schema.sql
psql -d accesslens -f database/seed.sql
```

The seed adds an approved template for the [Selenium web form](https://www.selenium.dev/selenium/web/web-form.html).

### 3. Configure the backend

Copy `backend/.env.example` to `backend/.env`, then update the database credentials.

```dotenv
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173,chrome-extension://your-extension-id

DB_HOST=localhost
DB_PORT=5432
DB_NAME=accesslens
DB_USER=accesslens_user
DB_PASSWORD=replace_me
DB_SSL=false

AI_PROVIDER=groq
GROQ_API_KEY=replace_with_your_groq_secret_key
GROQ_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-20b
```

To use OpenAI instead, set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and a supported `AI_MODEL`. Use `DB_SSL=true` when required by your database provider. Never commit `backend/.env`.

### 4. Start the API

```bash
cd backend
npm run dev
```

Verify the database connection at <http://localhost:4000/api/health>.

### 5. Run the developer console

In a second terminal:

```bash
npm run dev
```

Open <http://localhost:5173>. The console displays generated templates awaiting review and provides editors for mappings and runner instructions.

### 6. Build and load the extension

```bash
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `dist` directory.
5. If needed, copy the installed extension ID into `FRONTEND_ORIGIN`, restart the API, and reload the extension.

## Testing the end-to-end flow

1. Keep the backend running.
2. Open the [Selenium web form](https://www.selenium.dev/selenium/web/web-form.html).
3. Complete the simplified AccessLens form in the page overlay.
4. Review the values and choose **Confirm and Fill Original Form**.
5. Confirm that the native fields are filled but the form is not submitted.
6. Open a supported `gov.lk` page with an unmapped form to exercise AI draft generation.
7. Review the new draft at <http://localhost:5173> before approving it.

After frontend or extension changes, run `npm run build`, reload the extension from `chrome://extensions`, and refresh the target page.

## Available scripts

| Location | Command | Purpose |
| --- | --- | --- |
| Project root | `npm run dev` | Start the Vite developer console |
| Project root | `npm run build` | Type-check and build the extension into `dist` |
| Project root | `npm run preview` | Preview the production frontend build |
| `backend/` | `npm run dev` | Run the API with file watching |
| `backend/` | `npm run build` | Compile the API to `backend/dist` |
| `backend/` | `npm start` | Run the compiled API |

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API and database health |
| `GET` | `/api/templates` | List approved templates |
| `GET` | `/api/templates/match?url=...` | Legacy URL-only approved-template match |
| `GET` | `/api/templates/resolve?url=...&heading=...` | Resolve exactly one approved template by URL and normalized H1 |
| `GET` | `/api/instructions/resolve?url=...&heading=...` | Resolve user-facing workflow guidance by URL and normalized H1 |
| `GET` | `/api/instructions/workflows/:workflowKey/first` | Return the first active workflow instruction |
| `POST` | `/api/instructions/:instructionId/ai-support` | Return a short AI simplification of an active instruction |
| `POST` | `/api/developer/website-requests/:id/generate-template` | Generate a pending draft for a requested website |
| `GET` | `/api/developer/stats` | Read developer-console counts |
| `GET` | `/api/developer/templates/pending` | List pending drafts |
| `PATCH` | `/api/developer/templates/:id` | Update a draft and its field mappings |
| `POST` | `/api/developer/templates/:id/validate` | Validate a draft |
| `POST` | `/api/developer/templates/:id/approve` | Approve a draft |
| `POST` | `/api/developer/templates/:id/reject` | Archive a rejected draft |

## Privacy and safety model

AccessLens is designed around three enforced template policies:

```ts
{
  storePersonalData: false,
  autoSubmit: false,
  manualReviewRequired: true
}
```

The database stores site configuration, template versions, field mappings, validation rules, runner instructions, and anonymous template errors. It must not store names, identity numbers, phone numbers, passwords, OTPs, payment details, or completed form values.

AI requests contain a page URL, title, language, and a filtered structural snapshot. Current input values are excluded. Generated selectors are checked against selectors observed in that snapshot, and new templates are saved as `pending_review` rather than automatically approved.

## Project structure

```text
AccessLens/
├── backend/              Express API, validation, and AI/template services
├── database/             PostgreSQL schema and demo seed
├── docs/                 Architecture notes and README artwork
├── public/               Chrome manifest and local test form
├── src/
│   ├── background/       Extension service worker
│   ├── content/          Page overlay, form discovery, and native filling
│   ├── api/              Frontend API clients
│   ├── components/       React UI components
│   ├── App.tsx           Developer console
│   └── separateWindow.ts Separate simplified-form window
└── vite.config.ts        Multi-entry extension build
```

For a deeper explanation of component boundaries and data handling, see [the architecture notes](docs/frontend-backend-database.md).

## Production checklist

- Add authentication and role-based authorization to `/api/developer/*`.
- Restrict CORS to the deployed console and extension origins.
- Put the API behind TLS and add durable rate limiting.
- Use a least-privilege database role and managed secrets.
- Add automated unit, API, and browser-extension tests.
- Complete accessibility and bilingual-content reviews.
- Define retention and monitoring policies for anonymous errors.

