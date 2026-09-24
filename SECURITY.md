# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could put users,
contributors, or deployments at risk.

Use GitHub's private vulnerability reporting / Security Advisory feature for this
repository when available.

Include:

- affected commit/version
- reproduction steps
- expected vs actual behavior
- security impact
- browser/platform
- proof-of-concept details needed to reproduce safely

Do not include real credentials, tokens, private user data, or destructive payloads.

## Scope

This project is a client-heavy browser game. Relevant reports include:

- XSS or unsafe HTML injection
- exposed secrets or credentials
- dependency vulnerabilities with a realistic exploit path
- unsafe persistence or local-storage handling
- malicious asset/file handling
- supply-chain or build-script compromise
- deployment configuration that exposes sensitive information

Gameplay bugs without a security impact should use the normal bug template.