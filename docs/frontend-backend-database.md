# AccessLens Frontend, Backend, And Database Separation

## Frontend Extension

The frontend is the browser extension. It must not contain database credentials.

Responsibilities:

- Detect the current website URL.
- Request an approved template from the backend.
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
- Support future admin/template tooling.

Suggested stack:

- Node.js
- Express
- TypeScript
- PostgreSQL `pg`
- Zod

API endpoints:

- `GET /api/health`
- `GET /api/templates`
- `GET /api/templates/match?url=https://www.selenium.dev/selenium/web/web-form.html`

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

Do not store:

- NIC numbers
- Names
- Phone numbers
- Passwords
- OTP codes
- Payment details
- Filled form values

## Setup Order

1. Create a PostgreSQL database.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.
4. Copy `backend/.env.example` to `backend/.env`.
5. Add your database host, port, database, user, and password.
6. Install backend dependencies.
7. Run the backend.
8. The extension can request templates from `http://localhost:4000/api`.
