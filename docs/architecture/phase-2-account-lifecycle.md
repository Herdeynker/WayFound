# WAYFOUND Phase 2 account lifecycle

Phase 2 establishes the protected queues and server worker boundaries for export and deletion. The browser can request or cancel work, but it cannot mark a request complete, access another user’s request, or delete an account.

- `data_export_requests` is an idempotent per-user queue. A server worker claims `pending` work, runs an injected export worker, and records only a safe status or redacted failure code.
- `account_deletion_requests` has a configurable grace period (`ACCOUNT_DELETION_GRACE_DAYS`, default 30). Cancellation is a security-definer function that checks the current user and pending state. Destructive/anonymizing work is an injected server hook and is not enabled until retention/legal policy is approved.
- Consent is append-only and versioned by `PHASE2_POLICY_VERSION`; a later policy version creates new records rather than overwriting history.
- Audit metadata is intentionally limited to non-sensitive scalar values. Tokens, passwords, email addresses, profile fields and document content are not written to logs or audit metadata.

The implementation is a Phase 2 foundation. It does not claim that an export artifact is already delivered or that account deletion/anonymization has already run in production.
