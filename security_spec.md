# Security Specification: Multi-tenant Medical Dashboard (Hanen Pro)

## 1. Data Invariants
1. **Tenant Isolation**: A user can only access data (patients, alerts, sessions) within their assigned tenant. The user must exist in `/tenants/{tenantId}/users/{userId}`.
2. **Identity Integrity**: Users cannot spoof their identity or roles. System-assigned roles are used to determine admin-level access within a tenant.
3. **Temporal Integrity**: All creations must use `request.time` for `createdAt`. All updates must use `request.time` for `updatedAt`.
4. **Data Shape Validation**: All fields must conform to exact schemas (no shadow fields, no junk IDs). Arrays like `conditions` and `detectedSigns` must be bounded.
5. **System-Only Fields**: `createdAt` cannot be modified.

## 2. The "Dirty Dozen" Payloads
1. **Tenant Escaping**: Attempt to list patients in Tenant B using an access token belonging to a user in Tenant A.
2. **Role Spoofing (Create)**: Attempt to create a user profile in Tenant A with `role: "admin"` when not an admin.
3. **Role Escalation (Update)**: Attempt to update own user profile in Tenant A to `role: "admin"`.
4. **Shadow Field Injection**: Attempt to create a Patient with a ghost field `isVIP: true`.
5. **Value Poisoning**: Attempt to update a Patient's `age` to a string instead of a number.
6. **Denial of Wallet (Huge String)**: Attempt to set a Patient's `notes` to a 500KB string.
7. **Denial of Wallet (Huge Array)**: Attempt to submit `conditions` array with 500 items.
8. **ID Poisoning**: Attempt to create a patient with a document ID containing special characters `../../admin`.
9. **Temporal Forge (Create)**: Attempt to set `createdAt` to a date in the past.
10. **Temporal Forge (Update)**: Attempt to update a document but ignore `updatedAt` or set it to a future date.
11. **State Shortcutting**: Update a VoiceAlert from Active to Resolved but modify `duration` at the same time.
12. **Unverified Spoofing**: Attempt to write as a user whose email is not verified.

## 3. The Test Runner
A test suite will be generated to verify that the dirty dozen payloads return PERMISSION_DENIED.
