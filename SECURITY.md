# Security Policy

## Supported version

Security fixes currently target the latest published WovenNote release.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Use this repository's **Security** tab to submit a private vulnerability report.

Include the affected version, reproduction steps, expected impact, and any suggested mitigation. Do not include real API keys, personal notes, databases, backups, or user attachments.

## Secrets and local data

WovenNote stores notes and attachments locally. OpenAI API keys are optional, encrypted with Electron `safeStorage` on Windows, excluded from backups, and never intentionally logged. If a real key is accidentally exposed, revoke it immediately in the OpenAI dashboard.
