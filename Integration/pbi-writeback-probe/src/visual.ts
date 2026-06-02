"use strict";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;

// Authentication API types (PBI API 5.9.1+)
type AcquireAADTokenResult = {
    accessToken?: string;
    expiresOn?: number;
    userInfo?: { userId?: string; tenantId?: string };
    fabricInfo?: { cloudName?: string };
};

type PrivilegeStatus =
    | "Allowed"
    | "NotDeclared"
    | "NotSupported"
    | "DisabledByAdmin";

interface AcquireAADTokenService {
    acquireAADToken(): Promise<AcquireAADTokenResult>;
    acquireAADTokenstatus(): Promise<PrivilegeStatus>;
}

interface ProbeConfig {
    siteUrl: string;
    titleField: string;
    alternateAudience: string;
}

interface ParsedUrl {
    hostname: string;     // e.g. "contoso.sharepoint.com"
    sitePath: string;     // e.g. "/sites/finance"  (empty string if root site)
    listName: string;     // e.g. "WritebackTest"
}

const DEFAULT_CONFIG: ProbeConfig = {
    siteUrl: "",
    titleField: "Probe test row",
    alternateAudience: ""
};

export class WritebackProbe implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private statusEl: HTMLElement;
    private responseEl: HTMLElement;
    private button: HTMLButtonElement;
    private configSummaryEl: HTMLElement;
    private config: ProbeConfig = { ...DEFAULT_CONFIG };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.root = options.element;
        this.root.classList.add("writeback-probe");
        this.statusEl = document.createElement("div");
        this.responseEl = document.createElement("pre");
        this.button = document.createElement("button");
        this.configSummaryEl = document.createElement("div");
        this.render();
    }

    public update(options: VisualUpdateOptions): void {
        this.config = this.readConfig(options.dataViews && options.dataViews[0]);
        this.refreshConfigSummary();
    }

    public enumerateObjectInstances(
        options: EnumerateVisualObjectInstancesOptions
    ): VisualObjectInstanceEnumeration {
        const instances: VisualObjectInstance[] = [];
        if (options.objectName === "config") {
            instances.push({
                objectName: "config",
                properties: this.config as unknown as { [k: string]: powerbi.DataViewPropertyValue },
                selector: undefined
            });
        }
        return instances;
    }

    private readConfig(dv: DataView | undefined): ProbeConfig {
        const out: ProbeConfig = { ...DEFAULT_CONFIG };
        const meta = dv && dv.metadata && dv.metadata.objects;
        if (meta && meta.config) {
            const c = meta.config as { [k: string]: powerbi.DataViewPropertyValue };
            if (typeof c.siteUrl === "string") out.siteUrl = c.siteUrl;
            if (typeof c.titleField === "string") out.titleField = c.titleField || DEFAULT_CONFIG.titleField;
            if (typeof c.alternateAudience === "string") out.alternateAudience = c.alternateAudience;
        }
        return out;
    }

    private render(): void {
        while (this.root.firstChild) {
            this.root.removeChild(this.root.firstChild);
        }

        const wrap = document.createElement("div");
        wrap.className = "wp-wrap";

        const title = document.createElement("h2");
        title.textContent = "Writeback Probe — SharePoint Test";
        title.className = "wp-title";
        wrap.appendChild(title);

        const subtitle = document.createElement("p");
        subtitle.textContent =
            "Paste your SharePoint list URL in the Format pane, then click Probe Writeback. " +
            "The visual figures out the Graph IDs itself and writes one test row.";
        subtitle.className = "wp-sub";
        wrap.appendChild(subtitle);

        this.configSummaryEl.className = "wp-config-summary";
        wrap.appendChild(this.configSummaryEl);

        this.button.textContent = "Probe Writeback";
        this.button.className = "wp-button";
        this.button.addEventListener("click", () => this.runProbe());
        wrap.appendChild(this.button);

        const statusBox = document.createElement("div");
        statusBox.className = "wp-statusbox";

        const statusLabel = document.createElement("div");
        statusLabel.className = "wp-label";
        statusLabel.textContent = "Status";
        statusBox.appendChild(statusLabel);

        this.statusEl.className = "wp-status wp-neutral";
        this.statusEl.textContent = "Idle — click the button to begin";
        statusBox.appendChild(this.statusEl);

        wrap.appendChild(statusBox);

        const responseBox = document.createElement("div");
        responseBox.className = "wp-responsebox";

        const responseLabel = document.createElement("div");
        responseLabel.className = "wp-label";
        responseLabel.textContent = "Response detail";
        responseBox.appendChild(responseLabel);

        this.responseEl.className = "wp-response";
        this.responseEl.textContent = "—";
        responseBox.appendChild(this.responseEl);

        wrap.appendChild(responseBox);

        const footer = document.createElement("div");
        footer.className = "wp-footer";
        footer.appendChild(document.createTextNode("Color codes: "));
        const g = document.createElement("span"); g.className = "wp-good"; g.textContent = "green"; footer.appendChild(g);
        footer.appendChild(document.createTextNode(" = success | "));
        const y = document.createElement("span"); y.className = "wp-warn"; y.textContent = "yellow"; footer.appendChild(y);
        footer.appendChild(document.createTextNode(" = partial / scope issue | "));
        const r = document.createElement("span"); r.className = "wp-bad"; r.textContent = "red"; footer.appendChild(r);
        footer.appendChild(document.createTextNode(" = failure"));
        wrap.appendChild(footer);

        this.root.appendChild(wrap);

        this.refreshConfigSummary();
    }

    private refreshConfigSummary(): void {
        if (!this.configSummaryEl) return;
        while (this.configSummaryEl.firstChild) {
            this.configSummaryEl.removeChild(this.configSummaryEl.firstChild);
        }
        const c = this.config;
        const audience = c.alternateAudience || "https://graph.microsoft.com";
        this.appendCfgRow("AAD audience", audience, false);
        this.appendCfgRow("SharePoint List URL", c.siteUrl, !c.siteUrl);
        this.appendCfgRow("Title value", c.titleField, false);

        // Show parsed URL components if parseable
        if (c.siteUrl) {
            const parsed = this.parseSharePointUrl(c.siteUrl);
            if (parsed) {
                this.appendCfgRow("  → hostname", parsed.hostname, false);
                this.appendCfgRow("  → site path", parsed.sitePath || "(root site)", false);
                this.appendCfgRow("  → list name", parsed.listName, false);
            } else {
                this.appendCfgRow("  → parse error", "URL doesn't match SharePoint list pattern", true);
            }
        }
    }

    private appendCfgRow(label: string, value: string, missing: boolean): void {
        const row = document.createElement("div");
        row.className = "wp-cfg-row";
        const b = document.createElement("b");
        b.textContent = label + ": ";
        row.appendChild(b);
        if (missing) {
            const i = document.createElement("i");
            i.textContent = value || "(not configured)";
            row.appendChild(i);
        } else {
            row.appendChild(document.createTextNode(value));
        }
        this.configSummaryEl.appendChild(row);
    }

    /**
     * Parse a SharePoint list URL into hostname + site path + list name.
     * Accepted forms:
     *   https://tenant.sharepoint.com/sites/finance/Lists/MyList
     *   https://tenant.sharepoint.com/sites/finance/Lists/MyList/
     *   https://tenant.sharepoint.com/sites/finance/Lists/MyList/AllItems.aspx
     *   https://tenant.sharepoint.com/sites/finance/Lists/MyList/Forms/AllItems.aspx
     *   https://tenant.sharepoint.com/Lists/MyList         (root site)
     */
    private parseSharePointUrl(raw: string): ParsedUrl | null {
        if (!raw) return null;
        const trimmed = raw.trim();
        // Match: protocol + hostname + (optional site path) + /Lists/ + listname + (optional trailing)
        const m = /^https?:\/\/([^\/]+)(\/.*?)?\/Lists\/([^\/\?#]+)(\/.*)?$/i.exec(trimmed);
        if (!m) return null;
        const hostname = m[1];
        const sitePath = (m[2] || "").replace(/\/$/, ""); // strip trailing /
        const listName = decodeURIComponent(m[3]);
        return { hostname, sitePath, listName };
    }

    private async runProbe(): Promise<void> {
        this.responseEl.textContent = "—";

        // Step 0 — URL parse
        if (!this.config.siteUrl) {
            this.setStatus("Configuration missing — paste a SharePoint List URL in the Format pane", "bad");
            return;
        }

        const parsed = this.parseSharePointUrl(this.config.siteUrl);
        if (!parsed) {
            this.setStatus("URL doesn't match SharePoint list pattern", "bad");
            this.appendResponse(
                "Expected something like:\n  https://[tenant].sharepoint.com/sites/[sitename]/Lists/[listname]\n\nGot: " +
                this.config.siteUrl
            );
            return;
        }
        this.appendResponse(
            "Parsed URL:\n  hostname:  " + parsed.hostname +
            "\n  site path: " + (parsed.sitePath || "(root site)") +
            "\n  list name: " + parsed.listName
        );

        // Step 1 — token service availability
        this.setStatus("Step 1/5 — checking acquireAADTokenService", "neutral");
        const svc = this.getAcquireAADTokenService();
        if (!svc) {
            this.setStatus(
                "FAILURE — host.acquireAADTokenService is undefined. PBI Desktop may not expose Authentication API 5.9.1+.",
                "bad"
            );
            this.appendResponse("\n\nacquireAADTokenService is undefined on the host object.");
            return;
        }

        // Step 2 — token status
        this.setStatus("Step 2/5 — acquireAADTokenstatus()", "neutral");
        let status: PrivilegeStatus;
        try {
            status = await svc.acquireAADTokenstatus();
        } catch (e) {
            this.setStatus("FAILURE — acquireAADTokenstatus() threw", "bad");
            this.appendResponse("\n\nException: " + this.errMsg(e));
            return;
        }
        this.appendResponse("\n\nacquireAADTokenstatus() returned: " + status);

        if (status !== "Allowed") {
            this.setStatus("BLOCKED — token acquisition not allowed: " + status, "bad");
            this.appendResponse("\nDiagnosis: " + this.explainStatus(status));
            return;
        }

        // Step 3 — acquire token
        this.setStatus("Step 3/5 — acquireAADToken()", "neutral");
        let tokenResult: AcquireAADTokenResult;
        try {
            tokenResult = await svc.acquireAADToken();
        } catch (e) {
            this.setStatus("FAILURE — acquireAADToken() threw", "bad");
            this.appendResponse("\n\nException: " + this.errMsg(e));
            return;
        }
        if (!tokenResult || !tokenResult.accessToken) {
            this.setStatus("FAILURE — acquireAADToken() returned null/empty", "bad");
            this.appendResponse(
                "\n\nResult: " + JSON.stringify(tokenResult, null, 2) +
                "\n\nDiagnosis: Fabric refused to issue a token for the declared audience. " +
                "Try the alternateAudience field with an ISV-registered Entra app URI."
            );
            return;
        }
        const token = tokenResult.accessToken;
        const tokenPreview = token.substring(0, 16) + "..." + token.substring(token.length - 8);
        this.appendResponse(
            "\n\nToken acquired (preview): " + tokenPreview +
            "\n  tenantId: " + (tokenResult.userInfo && tokenResult.userInfo.tenantId || "?") +
            "\n  userId:   " + (tokenResult.userInfo && tokenResult.userInfo.userId || "?")
        );

        // Step 4 — resolve Graph site ID
        this.setStatus("Step 4/5 — resolving SharePoint site via Graph", "neutral");
        const siteResolveUrl = parsed.sitePath
            ? "https://graph.microsoft.com/v1.0/sites/" + parsed.hostname + ":" + parsed.sitePath
            : "https://graph.microsoft.com/v1.0/sites/" + parsed.hostname;

        let siteId: string;
        try {
            const siteRes = await fetch(siteResolveUrl, {
                method: "GET",
                headers: { "Authorization": "Bearer " + token, "Accept": "application/json" }
            });
            const siteText = await siteRes.text();
            this.appendResponse(
                "\n\nGET " + siteResolveUrl +
                "\n  → HTTP " + siteRes.status + " " + siteRes.statusText
            );
            if (!siteRes.ok) {
                this.diagnoseHttpFailure(siteRes.status, "site resolution");
                this.appendResponse("\n  Response: " + siteText.substring(0, 1000));
                return;
            }
            const siteJson = JSON.parse(siteText);
            siteId = siteJson.id;
            this.appendResponse("\n  Site ID resolved: " + siteId);
        } catch (e) {
            this.handleFetchException(e, "site resolution");
            return;
        }

        // Step 5 — resolve list ID by name
        this.setStatus("Step 5a/5 — resolving list ID by name", "neutral");
        const listsUrl = "https://graph.microsoft.com/v1.0/sites/" + encodeURIComponent(siteId) + "/lists";
        let listId: string;
        try {
            const listsRes = await fetch(listsUrl, {
                method: "GET",
                headers: { "Authorization": "Bearer " + token, "Accept": "application/json" }
            });
            const listsText = await listsRes.text();
            this.appendResponse(
                "\n\nGET " + listsUrl +
                "\n  → HTTP " + listsRes.status + " " + listsRes.statusText
            );
            if (!listsRes.ok) {
                this.diagnoseHttpFailure(listsRes.status, "list enumeration");
                this.appendResponse("\n  Response: " + listsText.substring(0, 1000));
                return;
            }
            const listsJson = JSON.parse(listsText);
            const arr = (listsJson && listsJson.value) as { id?: string; displayName?: string; name?: string }[] | undefined;
            if (!arr || arr.length === 0) {
                this.setStatus("FAILURE — site has no lists (or none visible to your user)", "bad");
                return;
            }
            const wanted = parsed.listName.toLowerCase();
            const match = arr.find(l =>
                (l.displayName && l.displayName.toLowerCase() === wanted) ||
                (l.name && l.name.toLowerCase() === wanted)
            );
            if (!match || !match.id) {
                const found = arr.map(l => l.displayName || l.name || "?").join(", ");
                this.setStatus("FAILURE — list '" + parsed.listName + "' not found at that site", "bad");
                this.appendResponse("\n  Lists found in site: " + found);
                return;
            }
            listId = match.id;
            this.appendResponse("\n  List ID resolved: " + listId);
        } catch (e) {
            this.handleFetchException(e, "list enumeration");
            return;
        }

        // Step 5b — POST the new item
        this.setStatus("Step 5b/5 — POST new item to list", "neutral");
        const itemsUrl =
            "https://graph.microsoft.com/v1.0/sites/" +
            encodeURIComponent(siteId) +
            "/lists/" +
            encodeURIComponent(listId) +
            "/items";
        const body = { fields: { Title: this.config.titleField || "Probe test row" } };

        let response: Response;
        try {
            response = await fetch(itemsUrl, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(body)
            });
        } catch (e) {
            this.handleFetchException(e, "item create");
            return;
        }

        const respText = await response.text();
        let respJson: unknown = null;
        try { respJson = JSON.parse(respText); } catch { /* ignore */ }

        this.appendResponse(
            "\n\nPOST " + itemsUrl +
            "\n  → HTTP " + response.status + " " + response.statusText +
            "\n\nResponse body:\n" +
            (respJson ? JSON.stringify(respJson, null, 2) : respText.substring(0, 4000))
        );

        if (response.status >= 200 && response.status < 300) {
            this.setStatus(
                "SUCCESS — HTTP " + response.status + " — item created. Check your SharePoint list.",
                "good"
            );
        } else {
            this.diagnoseHttpFailure(response.status, "item create");
        }
    }

    private diagnoseHttpFailure(status: number, step: string): void {
        if (status === 401) {
            this.setStatus("FAILURE — HTTP 401 on " + step + " — token rejected (audience/expiry)", "bad");
        } else if (status === 403) {
            this.setStatus(
                "PARTIAL — HTTP 403 on " + step + " — token OK but missing Sites.ReadWrite.All scope. Tenant admin needs to grant + consent.",
                "warn"
            );
        } else if (status === 404) {
            this.setStatus("FAILURE — HTTP 404 on " + step + " — resource not found or hidden from your user", "bad");
        } else {
            this.setStatus("FAILURE — HTTP " + status + " on " + step, "bad");
        }
    }

    private handleFetchException(e: unknown, step: string): void {
        const msg = this.errMsg(e);
        const isCors = /failed to fetch|networkerror|cors/i.test(msg);
        this.setStatus(
            isCors
                ? "FAILURE — likely CORS block on " + step + " (Graph rejected the iframe origin)"
                : "FAILURE — fetch threw on " + step,
            "bad"
        );
        this.appendResponse(
            "\n\nException: " + msg +
            (isCors
                ? "\n\nDiagnosis: Graph CORS doesn't allow this iframe's origin. " +
                  "Check browser DevTools console for the exact CORS rejection. " +
                  "Fallback: tiny Azure Function CORS-relay becomes the minimum-external path."
                : "")
        );
    }

    private getAcquireAADTokenService(): AcquireAADTokenService | null {
        const host = this.host as unknown as { acquireAADTokenService?: AcquireAADTokenService };
        return host.acquireAADTokenService || null;
    }

    private explainStatus(s: PrivilegeStatus): string {
        switch (s) {
            case "NotDeclared":
                return "AADAuthentication privilege not declared in capabilities.json (build problem).";
            case "NotSupported":
                return "Current PBI environment doesn't support the Authentication API. Try PBI Desktop on Windows.";
            case "DisabledByAdmin":
                return "Tenant admin has disabled custom-visual AAD auth globally. Admin enables in Fabric admin portal.";
            default:
                return "Unknown status: " + s;
        }
    }

    private setStatus(text: string, kind: "good" | "warn" | "bad" | "neutral"): void {
        this.statusEl.textContent = text;
        this.statusEl.className = "wp-status wp-" + kind;
    }

    private appendResponse(text: string): void {
        if (this.responseEl.textContent === "—") {
            this.responseEl.textContent = text;
        } else {
            this.responseEl.textContent = (this.responseEl.textContent || "") + text;
        }
    }

    private errMsg(e: unknown): string {
        if (e instanceof Error) return e.name + ": " + e.message;
        if (typeof e === "string") return e;
        try { return JSON.stringify(e); } catch { return String(e); }
    }
}
