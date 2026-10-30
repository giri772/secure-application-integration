# Short security checklist

## Implemented in this learning demo

- [x] Server validates application fields independently of browser validation.
- [x] Search is trimmed and length-capped; categories are checked against a fixed allowlist.
- [x] Application JSON body is limited to 16 KB and non-JSON submissions are rejected.
- [x] Basic per-IP rate limiting returns `429` and `Retry-After`.
- [x] Origin checks and a restrictive Content Security Policy are applied.
- [x] `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are set.
- [x] Frontend renders API text with HTML escaping; it does not inject applicant-provided content into the page.
- [x] Errors do not include stack traces or submitted personal details.
- [x] Application success responses exclude name, email, education, and cover letter.

## Before using real applicant data

- [ ] Store submissions in a maintained database with access controls, backups, and defined retention/deletion.
- [ ] Add TLS/HTTPS, secrets management, deployment-specific allowed origins, logging, monitoring, and incident response.
- [ ] Use a shared rate-limit store and configure proxy trust carefully if deployed behind a proxy/load balancer.
- [ ] Decide who can access applications; add authentication/authorization and audit access.
- [ ] Publish a privacy notice and collect only data needed for the hiring process.
- [ ] Add spam/abuse controls and an email verification policy if appropriate.
- [ ] Review dependency and runtime updates before each release.

This project demonstrates foundational controls. It has no database, user accounts, transport encryption when run locally, or production abuse monitoring.
