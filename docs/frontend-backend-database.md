# AccessLens Frontend, Backend, And Database Separation

## Frontend Extension

The frontend is the browser extension. It must not contain database credentials.

Responsibilities:

- Detect the current website URL.
- Request an approved template from the backend.
- When no approved template exists, show the user the website-support request button.
- Render the AccessLens UI.
- Collect user input in browser memory only.
- Validate and normalize user input locally.
- Fill the original website fields.
- Show final review before native submission.
- Clear temporary personal data after completion.

Suggested stack:

- React
- TypeScript
- Vite
- Chrome Extension Manifest V3
- Shadow DOM
- Tailwind CSS later

## Backend API

The backend protects database credentials and serves approved templates.

Responsibilities:

- Receive a URL from the extension.
- Find a matching approved template.
- Return template JSON to the extension.
- Generate a draft template with the configured AI provider only when a developer starts generation for a website request.
- Validate every AI response and reject selectors that were not present in the page snapshot.
- Save generated templates as `pending_review`, never as automatically approved templates.
- Support future admin/template tooling.

Suggested stack:

- Node.js
- Express
- TypeScript
- PostgreSQL `pg`
- Zod
- OpenAI Node SDK, used for OpenAI and Groq's OpenAI-compatible API

API endpoints:

- `GET /api/health`
- `GET /api/templates`
- `GET /api/templates/match?url=https://www.selenium.dev/selenium/web/web-form.html`
- `POST /api/developer/website-requests/:id/generate-template`

## Database

The relational database stores public configuration, not user form values.

Store:

- Supported sites
- URL patterns
- Approved templates
- Template versions
- Field mappings
- Runner instructions
- Validation rules
- Anonymous template errors
- AI-generated template drafts awaiting review

Do not store:

- NIC numbers
- Names
- Phone numbers
- Passwords
- OTP codes
- Payment details
- Filled form values

The AI request contains only the page URL, title, language, field labels, field types,
CSS selectors, required flags, select option labels, and form context labels. It does
not contain the current values of any website fields.

## Updated Runtime Flow

1. The extension opens on a supported `gov.lk` page or the Selenium demo page.
2. It asks the backend for an approved database template.
3. If one exists, the extension renders it immediately without calling AI.
4. If none exists, the extension shows only the website-support request card; it does not call AI.
5. The user submits the request, which appears in the developer console.
6. A developer starts template generation for that website request.
7. The backend scans the requested page and asks the configured AI model for a structured template.
8. The backend validates the result and saves it with `pending_review` status.
9. The developer reviews, validates, and approves the template in the console.
10. On a future visit, the extension can load and use the approved template.

Approve a tested template with:

```sql
update templates
set status = 'approved', updated_at = now()
where template_key = 'the-template-key-you-reviewed';
```

## Setup Order

1. Create a PostgreSQL database.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.
4. Copy `backend/.env.example` to `backend/.env`.
5. Add your database host, port, database, user, and password.
6. Add AI settings to `backend/.env`.
7. For Groq free API usage, use `AI_PROVIDER=groq`, `GROQ_API_KEY`, and `AI_MODEL=openai/gpt-oss-20b`.
8. For OpenAI usage, use `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `AI_MODEL=gpt-5-mini`.
9. Confirm that the selected AI provider has available credits or free-tier quota.
10. Install backend dependencies.
11. Run the backend.
12. Build and reload the extension.
13. The extension can request templates from `http://localhost:4000/api`.
