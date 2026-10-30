# Firstlight — Secure Application Integration

A complete beginner-friendly example of connecting a frontend to an API, handling loading/empty/error/success states, validating an application on both client and server, and applying basic API security controls.

## What is included

- Responsive internship board with search, category filter, six sample internships, and application dialog.
- Node.js backend using built-in modules only. No package install or external service is required.
- `GET /api/internships` supports `search` and `type` query parameters.
- `POST /api/applications` validates and accepts applications. This demo stores them in memory until the server restarts.
- Rate limiting, request size limits, origin checks, parameterized query handling, secure headers, and server-side field validation.
- Automated integration tests, API examples, test scenarios, a security checklist, and a step-by-step guide.

## Requirements

- Node.js 20 or newer (Node 24 is fine).
- A terminal: PowerShell on Windows, Terminal on macOS, or a Linux shell.
- A web browser.

No database, API key, hosting account, or paid service is needed for the local demo.

## Run the project

1. Install Node.js from [nodejs.org](https://nodejs.org/) if `node --version` does not work. Choose the current LTS release.
2. Extract this project folder somewhere convenient, then open that folder in VS Code (or another code editor).
3. Open a terminal in the project folder. Confirm `package.json` is visible by running `dir` (PowerShell) or `ls` (macOS/Linux).
4. Run `node --version`. It should print `v20` or higher.
5. Start the app with `npm start`.
6. Open [http://localhost:3000](http://localhost:3000). Browse, search, filter, and submit a sample application.
7. Leave the terminal open while using the app. Press `Ctrl+C` there to stop it.

The project uses Node's standard library, so `npm install` is not needed. For automatic server restarts while editing, use `npm run dev`.

## Step-by-step project walkthrough

### 1. Start with the API

`server.js` creates a small HTTP server. It holds sample internship data, serves the page assets, and routes requests beginning with `/api/` to API handlers.

### 2. Return internship data

The page calls `GET /api/internships`. Search is sent as `?search=...`; a category is sent as `?type=Design`. The server trims and caps search input, validates the category, and filters the in-memory sample list.

### 3. Make each UI state visible

`public/app.js` shows a loading message while the request is in flight, a list after success, a clear message for no matches, and a retry button if the request fails. Search is debounced and prior requests are cancelled when a newer search starts.

### 4. Collect an application

Select Apply on an internship. The accessible dialog sends a JSON body to `POST /api/applications`. The browser uses built-in field constraints for quick feedback. The server independently validates all fields, because browser checks can be bypassed.

### 5. Protect the request path

The API enforces JSON content type and a 16 KB request limit, checks the requested origin, rate limits requests per client IP, returns defensive security headers, and accepts only known category values. Filtering uses fixed server-side fields and exact category matching; no user input becomes executable code or a database query.

### 6. Check the work

Run `npm test` to execute the integration checks. Run `npm run check` for syntax checks plus the same test suite. Expected scenarios are also listed in `data/integration-test-records.json`.

## API contract

### `GET /api/health`

Returns `200` and `{ "status": "ok" }`.

### `GET /api/internships?search=remote&type=Engineering`

Both query parameters are optional. `search` searches title, company, location, description, and skills. `type` must be Engineering, Data, Design, Marketing, or Operations.

Success response: `{ "items": [...], "total": 1 }`. Unknown categories return `400`.

### `POST /api/applications`

Send `Content-Type: application/json` and the following shape:

```json
{
  "internshipId": "int-101",
  "fullName": "Taylor Example",
  "email": "taylor@example.com",
  "education": "B.Sc. Computer Science, Year 2",
  "coverLetter": "I enjoy building useful interfaces and want to learn from this team."
}
```

Returns `201` with a generated receipt. Invalid fields return `422` with a `fields` object. Requests over the rate limit receive `429` and a `Retry-After` header. Applications are in-memory demo records only; restarting the server clears them.

## Configuration

Environment variables are optional. Defaults are shown in `.env.example`:

- `PORT` — web server port (default `3000`).
- `ALLOWED_ORIGIN` — browser origin permitted for API requests (defaults to this server's local origin).
- `RATE_LIMIT_WINDOW_MS` — rate limit window in milliseconds (default `60000`).
- `RATE_LIMIT_MAX` — API requests per client IP per window (default `60`).

Set these in the shell before `npm start`; `.env.example` is documentation and is not automatically loaded by Node.

## Submission checklist

- [ ] Run the app and verify search, category filtering, an empty result, an application validation error, and a successful application receipt.
- [ ] Run `npm test` and keep the passing output as your test report.
- [ ] Review `SECURITY_CHECKLIST.md` and note that applications are not persisted.
- [ ] Put this project folder and your test report in one public or view-only repository/folder.
- [ ] Add a short README or project page link and submit that single view-only link.

## Suggested 90–120 minute schedule

1. 10 minutes — prerequisites and project tour.
2. 20 minutes — run the site and map the frontend request to the API route.
3. 25 minutes — test search, filters, empty and failure states.
4. 25 minutes — submit valid and invalid applications; inspect server validation.
5. 20 minutes — run tests, review the checklist, and prepare your proof link.

## Next steps for a production version

Choose a persistent database, add authentication and authorization if applications are private, store only necessary personal information, configure HTTPS and production origin settings, use a distributed rate limiter behind a trusted proxy, add monitoring/backups/data-retention rules, and deploy the server and frontend. Do not treat this in-memory teaching demo as a production application database.
