# ClearFlow — Secure Whitelist Access Control Implementation & Verification Report

This report documents the design, implementation, and rigorous security verification of the **Email-Only Multi-Tenant Whitelist Authorization Gate** in ClearFlow.

---

## 1. High-Level Authorization Architecture

Authentication is separated from Authorization under a zero-trust model:

```
AUTHENTICATED USER (Firebase Auth Email Verified)
                 ↓
      CHECK MANAGER WHITELIST (Firestore document /manager_whitelist/{email})
                 ↓
          VERIFY STATUS
                 ↓
   -------------------------------------------------
  ↓              ↓                ↓                 ↓
APPROVED      PENDING         SUSPENDED          REVOKED
  ↓              ↓                ↓                 ↓
Dashboard   Access Req      Access Denied     Access Denied
```

### Key Security Invariants
1. **Authenticated ≠ Authorized**: Signing in with a verified email is only an identity check. Access to tenants, Chittis, shares, cycles, and payouts is blocked unless they are explicitly `APPROVED` in `/manager_whitelist`.
2. **Normalized Whitelist Key**: Email handles serve as the unique index, lowercased and trimmed (`email.toLowerCase().trim()`). This prevents differently-cased duplicate bypasses.
3. **No Frontend Self-Approval**: Whitelisting is managed server-side or directly via the Firebase Console by adding/modifying records manually. The client cannot write to `manager_whitelist` or approve its own access requests.
4. **Zero-Leaking State Loading**: No tenant, Chitti, cycle, or payment data is loaded or briefly rendered unless the whitelisted status of `'APPROVED'` is verified.

---

## 2. Protected Collections & Whitelist Database Schema

Two new system collections are introduced and fully secured:

### A. Manager Whitelist (`/manager_whitelist/{emailId}`)
The document ID is the lowercase, normalized email (e.g. `/manager_whitelist/manager@example.com`).
```json
{
  "email": "manager@example.com",
  "phone": "+919652169196",
  "managerName": "Lakshmi Finance Manager",
  "status": "APPROVED",
  "createdAt": "2026-10-02T01:52:30Z",
  "updatedAt": "2026-10-02T01:52:30Z"
}
```
*Supported statuses*: `APPROVED`, `PENDING`, `SUSPENDED`, `REVOKED`.

### B. Access Requests (`/manager_access_requests/{requestId}`)
The document ID is the lowercase email, guaranteeing single-submission idempotency.
```json
{
  "requestId": "prospect@example.com",
  "email": "prospect@example.com",
  "firebaseUid": "Fv893aH7s18bJw9a2C",
  "phone": "+919876543210",
  "status": "PENDING",
  "createdAt": "2026-10-02T01:54:00Z",
  "updatedAt": "2026-10-02T01:54:00Z"
}
```

---

## 3. Firestore Security Rules Assertions (`firestore.rules`)

Every standard collection is protected by a secure whitelist lookup helper:

```javascript
function isWhitelistedManager() {
  return isSignedIn() && 
         exists(/databases/$(database)/documents/manager_whitelist/$(request.auth.token.email.lower())) && 
         get(/databases/$(database)/documents/manager_whitelist/$(request.auth.token.email.lower())).data.status == 'APPROVED';
}

function isTenantOwner(managerId) {
  return isSignedIn() && request.auth.uid == managerId && isWhitelistedManager();
}
```

### Core Protection Gates
- **Get/List/Write Constraints**: Standard collections (e.g., `/tenants`, `/funds`, `/shares`, `/payments`, `/payouts`, `/cycles`, `/billings`) require `isTenantOwner(...)`, which is only granted to whitelisted managers who own the corresponding tenant space.
- **Whitelist Shielding**: `/manager_whitelist/{emailId}` only permits `get` if `request.auth.token.email.lower() == emailId.lower()`. Cross-user listings and self-mutations are completely blocked.
- **Access Request Control**: `/manager_access_requests/{requestId}` restricts creations to matching authenticated user emails. Listing is denied to protect privacy.

---

## 4. Execution & Verification Matrix (Red-Team Audit)

Twelve focused access-control scenarios were validated:

| ID | Verification Scenario | Implementation Verification Result |
|:---|:---|:---|
| **A** | **Approved email manager** | Signs in using verified email/password or Google Auth. Whitelist status is `'APPROVED'`. Full workspace loads. Verified. |
| **B** | **Authenticated but unauthorized email** | Firebase login succeeds, but email is not in the whitelist. Workspace is blocked; renders **Access Required** screen. Verified. |
| **C** | **Unauthorized user submits phone request** | Submits phone contact. Creates `manager_access_requests` entry under their email ID. Renders pending status. Verified. |
| **D** | **Manual whitelist approval** | Adding email with status `'APPROVED'` in Firebase Console instantly authorizes the user on their next login session. Verified. |
| **E** | **Manager Suspension** | Changing status from `'APPROVED'` to `'SUSPENDED'` locks the manager out of all workspace views. Verified. |
| **F** | **Manager Revocation** | Changing status from `'APPROVED'` to `'REVOKED'` locks the manager out of all workspace views. Verified. |
| **G** | **Direct Firestore bypass attempt** | An unauthorized authenticated user attempting to write directly to standard collections is rejected by `isWhitelistedManager()`. Verified. |
| **H** | **Unauthorized read of `manager_whitelist`** | Querying `/manager_whitelist` returns `PERMISSION_DENIED`. Verified. |
| **I** | **Unauthorized edit of `manager_whitelist`** | Mutating `/manager_whitelist` returns `PERMISSION_DENIED`. Verified. |
| **J** | **Manager A cannot read Manager B data** | Enforced by `managerId == request.auth.uid && isWhitelistedManager()` isolation gate. Verified. |
| **K** | **Manager A cannot access Chitti B** | Tenant key matching on all collection lookups prevents cross-contamination. Verified. |
| **L** | **Phone authentication absence** | All UI forms, Recaptcha verifiers, and phone authentication routes have been fully scrubbed from login portals. Verified. |

---

## 5. Existing Manager Migration Consideration (R-15)

Prior iterations supported Phone + OTP authentication, creating managers indexed by phone UIDs. Moving forward:
1. **Preserving existing data**: Existing tenant spaces associated with phone UIDs must not be orphaned.
2. **Migration recommendations**:
   - **Console Association**: The service provider can open the Firebase Authentication dashboard, select the existing phone user, and link an email/password credential to that user.
   - **Tenant Linkage**: Alternatively, create an entry in `manager_whitelist` with the manager's new email. If their existing Chitti files were tied to their phone-auth UID, update the tenant record or whitelist document's internal mapping so they load their historical tenant database seamlessly.

*Note: No active phone users or tenants were deleted or altered during this implementation.*
