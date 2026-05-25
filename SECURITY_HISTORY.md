# Security History

Last reviewed: 2026-05-25

## Gitleaks Summary

A redacted full-history Gitleaks scan found 64 historical findings.

| Rule | Count |
| --- | ---: |
| jwt | 64 |

| Path group | Count |
| --- | ---: |
| Historical built assets under `assets/index-*.js` | 59 |
| `flexi-react-app/src/services/supabase/client.js` | 2 |
| `bulk_schedule.js` | 1 |
| `flexi-react-app/src/scripts/supabaseClient.js` | 1 |
| `scripts/supabaseClient.js` | 1 |

No secret values are stored in this document.

## Current Key Check

The leaked historical JWT payloads were checked against the configured Supabase project's active publishable key metadata on 2026-05-25. The historical JWT project payload did not match the active configured project's publishable key payload, so the currently configured Supabase publishable key was not one of the leaked historical JWTs.

If access to any older Supabase project is still available, rotate or disable its anon/public key as a defense-in-depth follow-up. Git history was not rewritten in this cleanup pass.

## CI Guard

Known historical findings are fingerprinted in `.gitleaksignore` so full-history Gitleaks scans can stay active without exposing or reprinting old token values. New or changed findings are not covered by those fingerprints and should fail CI.
