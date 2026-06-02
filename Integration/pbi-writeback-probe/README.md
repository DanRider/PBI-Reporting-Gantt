# pbi-writeback-probe

Diagnostic Power BI custom visual that probes the Graph API direct writeback path against a SharePoint List. Self-diagnoses every failure mode so the test result tells you the exact next architectural step.

**This is a probe, not a production visual.** Goal: determine empirically whether `acquireAADTokenService` + Microsoft Graph + WebAccess privilege lets a PBI custom visual write directly to a SharePoint List using the signed-in user's delegated permissions — without a backend, without Power Automate, without middleware.

---

## Test sequence (do this on the work machine)

### One-time setup

1. **Install Power BI Desktop** (free, Microsoft Store) if not present.
2. **Enable developer mode**: PBI Desktop → File → Options and settings → Options → (Global) Security → check **"Developer Mode for Visuals"** → restart PBI Desktop.
3. **Side-load the visual**: Open any blank PBI report → Visualizations pane → click `...` → **"Import a visual from a file"** → select `dist/pbi-writeback-probe.pbiviz`.

### Prepare a SharePoint test list (M365 work tenant)

4. Open any SharePoint site in your work tenant.
5. Site contents → **+ New** → **List** → Blank list → name it `WritebackTest`.
6. Add columns: `Title` (default, already present) is enough for the v1 probe.
7. **Grab the Site ID**: in browser, visit `https://graph.microsoft.com/v1.0/sites/{your-tenant}.sharepoint.com:/sites/{your-site-name}` (use Graph Explorer at https://developer.microsoft.com/graph/graph-explorer to sign in with your work account and paste this URL). Note the returned `id` field — formatted like `tenant.sharepoint.com,siteguid,webguid`.
8. **Grab the List ID**: in Graph Explorer, GET `https://graph.microsoft.com/v1.0/sites/{site-id-from-step-7}/lists` → find your `WritebackTest` list → note its `id` (a GUID).

### Run the probe

9. Drop the **Writeback Probe** visual on a blank report page (no data bindings needed; the visual ignores `dataRoles`).
10. In the Format pane → **Writeback Target** card → paste:
    - **SharePoint Site ID**: the value from step 7
    - **SharePoint List ID**: the value from step 8
    - (leave **Title field value** as default, or override)
    - (leave **Alternate AAD audience** blank initially)
11. **Click the "Probe Writeback" button**.

### Read the result

The visual self-diagnoses. Match the **Status** color + text to the outcome table below:

| Status color | Status text starts with | Diagnosis |
|---|---|---|
| 🟢 Green | `SUCCESS — HTTP 2xx` | **The path works.** Graph accepted the token, wrote to SharePoint. Item should appear in the WritebackTest list. **Architecture validated.** |
| 🟡 Yellow | `PARTIAL — HTTP 403` | Token issued + accepted, but missing `Sites.ReadWrite.All` scope. **Fix: tenant admin grants scope + admin consent.** Retry. |
| 🔴 Red | `FAILURE — HTTP 401` | Graph rejected the token (audience or expiry). **Try the Alternate AAD audience field** with an ISV-registered Entra app URI. |
| 🔴 Red | `FAILURE — HTTP 404` | Site ID or List ID wrong, OR user lacks permission to see the resource. **Re-verify IDs in Graph Explorer.** |
| 🔴 Red | `FAILURE — likely CORS block` | Token works, but Graph CORS rejects the iframe's `null` origin. **Tiny Azure Function CORS-relay becomes the minimum-external path.** Path 3 fallback. |
| 🔴 Red | `BLOCKED — token acquisition not allowed: NotDeclared` | capabilities.json privilege missing. (Should not happen with this build; if it does, the build is bad.) |
| 🔴 Red | `BLOCKED — token acquisition not allowed: NotSupported` | Current PBI environment doesn't expose Authentication API. **Try PBI Desktop on Windows or PBI Service (web).** |
| 🔴 Red | `BLOCKED — token acquisition not allowed: DisabledByAdmin` | Tenant admin disabled custom visual auth. **Admin enables in Fabric admin portal → Tenant settings → Custom visuals.** |
| 🔴 Red | `FAILURE — acquireAADToken() returned null/empty` | Fabric refused to issue a token for the declared audience (likely `https://graph.microsoft.com` not pre-authorized). **Try the Alternate AAD audience field with an ISV Entra app URI.** |
| 🔴 Red | `FAILURE — host.acquireAADTokenService is undefined` | PBI Desktop version too old (need API 5.9.1+). **Update PBI Desktop.** |

### Report back

Screenshot the visual after clicking the button. Send the **Status** line + the **Response detail** body. That tells me exactly what happened and what to do next.

---

## What this visual does (architecture summary)

```
1. capabilities.json declares:
   - AADAuthentication privilege with audience = https://graph.microsoft.com
   - WebAccess privilege for https://graph.microsoft.com

2. On button click:
   a. Call host.acquireAADTokenService.acquireAADTokenstatus()
      → expect "Allowed"
   b. Call host.acquireAADTokenService.acquireAADToken()
      → expect a token with audience = graph.microsoft.com
   c. fetch('https://graph.microsoft.com/v1.0/sites/{siteId}/lists/{listId}/items',
            { method: 'POST',
              headers: { Authorization: Bearer <token>, Content-Type: application/json },
              body: { fields: { Title: '<configured value>' } } })
      → expect 201 Created with the new item's JSON

3. Render each step's result + the final status with color-coded diagnostic.
```

No backend. No Power Automate. No middleware. Just the visual + Graph + the user's session.

---

## What this visual deliberately does NOT do

- No production error handling beyond diagnostics
- No retry logic, no offline queue, no batch writes
- No multi-row writes (one item per button click)
- No data bindings (the visual ignores any data wells; configuration is Format Pane only)
- No localization, no theming, no accessibility polish
- No persistence of the configured Site ID / List ID across reports (Format Pane settings only)

These are deliberate omissions to keep the probe minimal. If the probe succeeds, those features land in the production `SharePointRowStore` per the INF-3709 design.

---

## What happens after the probe

| Probe outcome | Next architectural step |
|---|---|
| 🟢 Success | Extract the AAD + Graph pattern into the substrate npm package. Wire it as `SharePointRowStore` per INF-3709's pluggable RowStore design. Ship as Wave 2's writeback enhancement (Reporting-Gantt v2.4+). |
| 🟡 Partial (scope) | Document the admin-consent requirement. Same architecture path; just a tenant-setup step in customer onboarding. |
| 🟡 Partial (CORS) | Add a tiny Azure Function CORS-relay (~50 LOC) as the minimum-external path. Visual stays uncertified but writeback works. |
| 🔴 Failure (audience) | Try ISV Entra app registration in the Alternate AAD audience field. If that works, document the Entra app setup as customer prerequisite. |
| 🔴 Failure (fundamental) | Reconsider PCF in Canvas App (Power Apps Component Framework) as the writeback delivery vehicle. |

---

## Build (if rebuilding from source)

```bash
cd Integration/pbi-writeback-probe
npm install                # one-time, ~2-3 min
npm run package            # produces dist/pbiWritebackProbe<guid>.<version>.pbiviz
```

Or just grab the pre-built `.pbiviz` from `dist/` in this repo.
