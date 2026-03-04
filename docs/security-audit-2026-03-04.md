# Security Audit Report — Finance for All (Lovable + Supabase)

Date: 2026-03-04  
Auditor: Senior Security Review (Web + Supabase + Privacy)

## 1) Executive Summary

### Overall Security Score: **62 / 100**

The app has a strong baseline in several areas (RLS broadly enabled across all application tables, per-user isolation patterns in most policies, no secret keys hardcoded in frontend source). However, for a privacy-sensitive finance system, there are critical gaps in **data-at-rest exposure in browser cache**, **policy hardening**, and **GDPR-grade deletion architecture**.

### Top 5 Critical Risks

| Rank | Risk | Severity | Why it matters for a finance app |
|---|---|---|---|
| 1 | Service worker caches `/rest/v1` and `/functions/v1` API responses | **Critical** | Financial/PII data may remain in browser cache and be exposed on shared devices or via XSS post-compromise. |
| 2 | UPDATE RLS policies often missing explicit `WITH CHECK` ownership enforcement | **High** | Enables ownership-field tampering/data poisoning patterns (`user_id` reassignment) and weakens tenant integrity guarantees. |
| 3 | “Delete account” flow deletes app rows but not `auth.users` identity | **High** | GDPR/retention failure: account identity persists and deletion is non-atomic. |
| 4 | No storage security policy definitions present in repo migrations | **High** | If buckets are public/misconfigured in dashboard, sensitive documents could be internet-exposed. |
| 5 | Security headers and token-storage hardening are missing/weak for high-risk data | **High** | Increases blast radius of XSS/session theft attacks. |

---

## 2) Vulnerability Report

## A. OWASP Top 10 Mapping + Findings

| OWASP 2021 Category | Finding | Severity |
|---|---|---|
| A01 Broken Access Control | UPDATE policies without explicit `WITH CHECK` ownership validation | High |
| A02 Cryptographic Failures | Sensitive API payloads cached in service worker cache storage | Critical |
| A04 Insecure Design | Client-side, multi-step account deletion (non-atomic, non-privileged orchestration) | High |
| A05 Security Misconfiguration | Missing CSP/security-header hardening, minimal `supabase/config.toml` controls | High |
| A07 Identification & Authentication Failures | Session tokens persisted in `localStorage` and auth hardening controls not evidenced | High |
| A09 Security Logging & Monitoring Failures | Error logging may leak backend details to client console | Medium |
| A10 SSRF/Integrity (contextual) | No edge-function validation/rate-limit layer found for privileged workflows | Medium |

### Finding 1 — API data cached by service worker
- **Severity:** Critical  
- **Description:** The service worker caches GET responses for paths containing `/rest/v1/` and `/functions/v1/`, which are likely Supabase API responses containing transactions, categories, budgets, and investment data.
- **Exploitation scenario:** A user logs in on a shared device; app data is cached offline. Another local user (or malicious extension/script after compromise) reads cached responses and extracts full financial history.
- **Impact:** High-probability sensitive data exposure (financial profile + behavioral data), GDPR confidentiality risk.

### Finding 2 — Incomplete UPDATE RLS hardening (`WITH CHECK` absent)
- **Severity:** High  
- **Description:** Many UPDATE policies use `USING (auth.uid() = user_id)` without explicit `WITH CHECK (auth.uid() = user_id)`. This is weaker than strict ownership-preserving policies for finance multi-tenant data.
- **Exploitation scenario:** Authenticated attacker updates own row and mutates ownership columns (`user_id`) or cross-resource references; causes data poisoning, orphaning, and integrity breaks.
- **Impact:** Tenant data integrity degradation; possible confusion/DoS and policy bypass primitives depending on future schema evolution.

### Finding 3 — Account deletion is non-atomic and leaves auth identity
- **Severity:** High  
- **Description:** Frontend deletes rows from many tables but does not delete `auth.users` identity and is not transactional.
- **Exploitation scenario:** User believes account is deleted; identity persists in auth, and partial failures can leave residual personal data.
- **Impact:** GDPR non-compliance (right to erasure), legal/privacy exposure, inconsistent state.

### Finding 4 — Storage controls not defined as code
- **Severity:** High  
- **Description:** No storage bucket/policy migration content appears in repository. For Supabase, missing IaC policies creates drift and accidental public bucket risk.
- **Exploitation scenario:** Bucket configured as public in dashboard by mistake; uploaded statements/receipts become world-readable via URL.
- **Impact:** Direct document/PII leakage.

### Finding 5 — Session/token and browser hardening insufficient for high-risk PWA
- **Severity:** High  
- **Description:** Supabase auth uses `localStorage` persistence; index/vite config does not show CSP, frame-ancestors, or stricter browser security headers.
- **Exploitation scenario:** Any XSS compromise can exfiltrate tokens and replay session.
- **Impact:** Account takeover and mass data exfiltration.

### Finding 6 — No explicit auth abuse controls in code evidence
- **Severity:** Medium  
- **Description:** No visible CAPTCHA/anti-automation strategy, IP/device abuse controls, or login anomaly hooks in app layer.
- **Exploitation scenario:** Credential stuffing or signup abuse through public auth endpoints.
- **Impact:** Increased takeover risk and operational abuse.

### Finding 7 — Client console logging of raw errors
- **Severity:** Medium  
- **Description:** Multiple hooks log backend errors directly to console.
- **Exploitation scenario:** Shared terminal/browser logs leak internal error metadata (codes/messages) useful for reconnaissance.
- **Impact:** Low-to-medium information disclosure.

---

## 3) Code-Level Fixes (MANDATORY)

### 3.1 SQL — Enforce strict ownership checks on UPDATE

```sql
-- Example pattern: apply to every tenant table with user_id ownership
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets"
ON public.budgets
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### 3.2 SQL — Bind cross-resource ownership on mapping/source relations

```sql
DROP POLICY IF EXISTS "Users can create own mappings" ON public.import_source_column_mappings;
CREATE POLICY "Users can create own mappings"
ON public.import_source_column_mappings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.import_sources s
    WHERE s.id = source_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own mappings" ON public.import_source_column_mappings;
CREATE POLICY "Users can update own mappings"
ON public.import_source_column_mappings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.import_sources s
    WHERE s.id = source_id
      AND s.user_id = auth.uid()
  )
);
```

### 3.3 SQL — GDPR-grade account deletion (server-side, atomic)

```sql
-- Edge function should call this with service role + verified user context
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Keep transactional semantics
  DELETE FROM public.investment_snapshots
  WHERE investment_id IN (SELECT id FROM public.investments WHERE user_id = v_uid);

  DELETE FROM public.investments WHERE user_id = v_uid;
  DELETE FROM public.investment_types WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
  DELETE FROM public.import_rule_matches WHERE user_id = v_uid;
  DELETE FROM public.import_rules WHERE user_id = v_uid;
  DELETE FROM public.import_source_column_mappings WHERE user_id = v_uid;
  DELETE FROM public.import_batches WHERE user_id = v_uid;
  DELETE FROM public.import_sources WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.monthly_settings WHERE user_id = v_uid;
  DELETE FROM public.exchange_rates WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  DELETE FROM public.user_settings WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
```

> **Important:** this still does not delete `auth.users`; do that in a protected Edge Function using Supabase Admin API after successful transactional data wipe.

### 3.4 Frontend — Stop caching sensitive API responses in service worker

```js
// public/sw.js
const isApiRequest = () => false; // disable API response caching entirely

// OR keep only explicit non-sensitive, public endpoints:
const isApiRequest = ({ request, url }) => {
  if (request.method !== 'GET') return false;
  return url.pathname.startsWith('/api/public-rates');
};
```

Also add cache-control respect:

```js
if (response.headers.get('Cache-Control')?.includes('no-store')) {
  return response; // never cache sensitive responses
}
```

### 3.5 Frontend — tighten auth/token handling

```ts
// src/integrations/supabase/client.ts
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: sessionStorage, // less persistent than localStorage on shared devices
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'finance-for-all-web'
    }
  }
});
```

### 3.6 Supabase config / platform controls (set in dashboard + tracked as ops baseline)

- Enforce **Auth OTP/magic link expiry** (short TTL).  
- Enable **MFA (TOTP)** for users managing financial data.  
- Disable unused auth providers.  
- Configure strict redirect allowlist only for production domains.

### 3.7 Storage policy baseline

```sql
-- Private bucket pattern (example: statements)
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "Users can read own statement objects"
on storage.objects
for select
using (
  bucket_id = 'statements'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can upload own statement objects"
on storage.objects
for insert
with check (
  bucket_id = 'statements'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3.8 Edge Function baseline (for privileged actions)

```ts
// supabase/functions/delete-account/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1) transactional data wipe via RPC as user context
  const { error: wipeErr } = await userClient.rpc('delete_my_account');
  if (wipeErr) return new Response('Deletion failed', { status: 500, headers: corsHeaders });

  // 2) auth identity deletion via admin API
  const { error: delAuthErr } = await admin.auth.admin.deleteUser(user.id);
  if (delAuthErr) return new Response('Auth deletion failed', { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```

---

## 4) Architecture Improvements

## Secure-by-Design Target Architecture

1. **Browser (PWA)**
   - No sensitive API caching in service worker.
   - Strong CSP + Trusted Types (where feasible).
   - Minimal client-side PII retention.

2. **BFF/Edge Functions for privileged actions**
   - Account deletion/export, document processing, and any cross-table workflows move to Edge Functions.
   - Input schema validation (zod/valibot), auth check, rate limiting.

3. **Supabase Postgres**
   - RLS with strict `USING + WITH CHECK` for all mutable tenant tables.
   - Foreign key + policy ownership binding for all cross-resource references.
   - Security-definer functions minimized and permission-scoped.

4. **Storage segregation**
   - Private buckets by data class (`statements`, `exports`, `avatars`), each with dedicated policies.
   - Path convention `${auth.uid()}/...` required and enforced.

5. **Privacy operations**
   - Built-in data export RPC + deletion Edge Function.
   - Retention schedule and audit trail (non-sensitive logs only).

### Data Segregation Recommendations
- Split financial ledger data from profile/preferences schema (least-privilege grants).  
- Use dedicated schema for analytics aggregates with read-only RPC outputs.  
- Add immutable audit events table (no sensitive payloads, hashed references).

---

## 5) GDPR & Supabase Compliance Check

| Principle | Current State | Risk | Required Action |
|---|---|---|---|
| Data minimization | Moderate | Medium | Avoid storing unnecessary raw labels/categories; consider redaction rules. |
| Right to erasure | Partial | High | Complete deletion must include `auth.users` and be atomic/server-side. |
| Right to access/export | Not evidenced | Medium | Provide user export endpoint (JSON/CSV) with identity verification. |
| Consent & legal basis | Not evidenced | Medium | Add privacy notice + explicit consent tracking where required. |
| Security by design/default | Partial | High | Remove API caching, enforce strict policies, add headers/MFA/rate limits. |

---

## 6) Security Checklist (Actionable)

- [ ] Remove service-worker caching for `/rest/v1` and `/functions/v1` responses.
- [ ] Add explicit `WITH CHECK (auth.uid() = user_id)` to every UPDATE policy on tenant tables.
- [ ] Enforce ownership linkage on foreign-key references (`source_id`, `category_id`, etc.) in policies.
- [ ] Implement server-side `delete_my_account` + Edge Function that also deletes `auth.users`.
- [ ] Define Storage buckets/policies in migrations (private by default).
- [ ] Add CSP, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy.
- [ ] Move auth session persistence to less persistent storage if acceptable UX tradeoff; add inactivity logout.
- [ ] Enable MFA and tighten auth redirect allowlist/TTL in Supabase dashboard.
- [ ] Add rate limiting and payload validation for every Edge Function.
- [ ] Implement data export endpoint and documented GDPR workflows.
- [ ] Remove raw backend error logging from production client.

---

## 7) Roadmap (Quick Wins vs Heavy Fixes)

### Quick Wins (1–3 days)
1. Disable sensitive API caching in `public/sw.js`.  
2. Add missing `WITH CHECK` to UPDATE policies.  
3. Reduce production console error detail.  
4. Harden auth settings in Supabase dashboard (redirects, TTL, MFA optional rollout).

### Medium (1–2 sprints)
1. Build delete-account Edge Function + transactional RPC + auth identity deletion.  
2. Add storage bucket policies as code.  
3. Add CSP/security headers and test PWA compatibility.

### Heavy (2–4 sprints)
1. Full privacy operations module (export/erase/audit trail).  
2. Security observability: anomaly detection, SIEM-friendly redacted logs.  
3. Formal threat model and recurring penetration tests for release gating.

---

## 8) Scope Notes / Inferred Risks

- No `supabase/functions/` directory is present; edge-function controls were assessed as **missing by default** (risk).  
- Storage policies are not represented in migrations; treated as **unverifiable/high risk** in a financial context.  
- Supabase dashboard-only settings (MFA, OTP expiry, auth hardening) are not inspectable from repository and must be validated operationally.
