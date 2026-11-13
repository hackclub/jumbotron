<script>
    import { onMount } from "svelte";
    import { internal } from "$lib/liveshare.svelte.js";
    import { API } from "$lib/org.svelte.js";


    // Credentials always travel in a POST body, never in the URL.
    const authedPost = (path) =>
        fetch(`${API}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: internal.code, password: internal.password })
        });

    let eventsJson = $state("");
    let loadedJson = $state("");
    let bannedList = $state([]);
    let permanentBans = $state([]);     // set by the server's environment; can't be lifted here
    let restrictions = $state({});      // slack -> ["organize" | "host"]
    let kickTarget = $state("");
    let restrictTarget = $state("");
    let banTarget = $state("");
    let unbanTarget = $state("");
    let confirming = $state(null); // "ban" | "kick" | "save"
    let message = $state({ kind: "", text: "" });
    let loading = $state(false);

    let lookupCode = $state("");
    let lookupResult = $state("");
    let lookupError = $state("");

    let jsonError = $derived.by(() => {
        if (!eventsJson.trim()) return "";
        try { JSON.parse(eventsJson); return ""; } catch (e) { return `Not valid JSON: ${e.message}`; }
    });
    let jsonDirty = $derived(eventsJson !== loadedJson);

    const say = (kind, text) => (message = { kind, text });

    async function load() {
        loading = true;
        say("", "");
        try {
            const res = await authedPost("/allEvents");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return say("error", data.error || "Couldn't load events.");
            try { eventsJson = JSON.stringify(JSON.parse(data.list), null, 2); } catch { eventsJson = data.list ?? ""; }
            loadedJson = eventsJson;

            const banRes = await authedPost("/getBans");
            const banData = await banRes.json().catch(() => ({}));
            try { bannedList = banRes.ok && banData.list ? JSON.parse(banData.list) : []; } catch { bannedList = []; }
            permanentBans = banRes.ok && Array.isArray(banData.permanent) ? banData.permanent : [];
            restrictions = banRes.ok && banData.restrictions && typeof banData.restrictions === "object" ? banData.restrictions : {};
        } catch {
            say("error", "Network error while loading events.");
        } finally {
            loading = false;
        }
    }

    onMount(load);

    async function post(path, body, success) {
        say("", "");
        try {
            const res = await fetch(`${API}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: internal.code, password: internal.password, ...body })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { say("error", data.error || "Request failed."); return false; }
            say("ok", data.message || success);
            return true;
        } catch {
            say("error", "Network error. Nothing was changed.");
            return false;
        }
    }

    async function ban() {
        confirming = null;
        const id = banTarget.trim();
        if (await post("/banEvent", { banSlack: id }, `Banned ${id}.`)) { banTarget = ""; load(); }
    }

    async function unban(id) {
        id = id.trim();
        if (!id) return;
        if (await post("/unbanEvent", { unbanSlack: id }, `Unbanned ${id}.`)) { unbanTarget = ""; load(); }
    }

    // Signs them out everywhere without banning; they can sign in again.
    async function kick() {
        confirming = null;
        const id = kickTarget.trim().toUpperCase();
        if (await post("/kickUser", { slack: id }, `Signed ${id} out.`)) kickTarget = "";
    }

    // Partial bans: "organize" (someone else's event) or "host" (running any event).
    const SCOPES = [
        { key: "organize", label: "Organizing other events", sub: "Can't be added as an organizer; removed from any event they help with" },
        { key: "host", label: "Running events", sub: "Can sign in, but can't publish, rename, run demo time, pair screens or invite" }
    ];
    const scopeLabel = (key) => SCOPES.find((x) => x.key === key)?.label ?? key;

    async function restrict(slack, scope, restricted) {
        slack = slack.trim().toUpperCase();
        if (!slack) return;
        const verb = restricted ? "Restricted" : "Lifted";
        if (await post("/restrictUser", { slack, scope, restricted }, `${verb} ${scopeLabel(scope).toLowerCase()} for ${slack}.`)) load();
    }

    async function save() {
        confirming = null;
        if (await post("/setEvents", { items: eventsJson }, "Events database replaced.")) loadedJson = eventsJson;
    }

    async function copy(text) {
        try { await navigator.clipboard.writeText(text); say("ok", "Copied to clipboard."); } catch { say("error", "Couldn't copy."); }
    }

    function download() {
        const blob = new Blob([eventsJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: `active-tokens-${new Date().toISOString().slice(0, 10)}.json` });
        a.click();
        URL.revokeObjectURL(url);
    }

    async function lookup(event) {
        event.preventDefault();
        lookupError = "";
        lookupResult = "";
        const code = lookupCode.trim();
        if (!code) return;
        try {
            const res = await fetch(`${API}/getPacket?code=${encodeURIComponent(code)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { lookupError = data.error || `No packet for ${code}.`; return; }
            lookupResult = JSON.stringify(data, null, 2);
        } catch {
            lookupError = "Network error while fetching packet.";
        }
    }
</script>

<div class="admin">
    <div class="intro">
        <h2>Administrator</h2>
        <p class="hint">Changes here affect every event. Bans and kicks revoke the organizer's access immediately.</p>
    </div>

    {#if message.text}
        <p class="message {message.kind}" role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>
    {/if}

    <section class="block">
        <h3>Organizer access</h3>
        <div class="pair">
            <form class="inline" onsubmit={(e) => { e.preventDefault(); if (banTarget.trim()) confirming = "ban"; }}>
                <label class="field">
                    <span>Ban by Slack ID</span>
                    <input class="input mono" bind:value={banTarget} placeholder="U01ABC234" autocomplete="off" />
                </label>
                {#if confirming === "ban"}
                    <div class="confirm" role="group" aria-label="Confirm ban">
                        <p>Ban <strong class="mono">{banTarget.trim()}</strong> and end their sessions?</p>
                        <button type="button" class="btn btn-small btn-danger" onclick={ban}>Ban</button>
                        <button type="button" class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
                    </div>
                {:else}
                    <button class="btn btn-small" disabled={!banTarget.trim()}>Ban…</button>
                {/if}
            </form>

            <form class="inline" onsubmit={(e) => { e.preventDefault(); unban(unbanTarget); }}>
                <label class="field">
                    <span>Unban by Slack ID</span>
                    <input class="input mono" bind:value={unbanTarget} placeholder="U01ABC234" autocomplete="off" />
                </label>
                <button class="btn btn-small" disabled={!unbanTarget.trim()}>Unban</button>
            </form>
        </div>

        <div class="banned">
            <span class="field-label">Banned ({bannedList.length + permanentBans.filter((id) => !bannedList.includes(id)).length})</span>
            {#if bannedList.length || permanentBans.length}
                <ul>
                    {#each permanentBans.filter((id) => !bannedList.includes(id)) as id}
                        <li class="locked" title="Set by the server's environment. Remove it there and redeploy to lift it.">
                            <span class="mono">{id}</span><span class="icon lock" translate="no" aria-label="Permanent">lock</span>
                        </li>
                    {/each}
                    {#each bannedList as id}
                        <li><span class="mono">{id}</span><button class="chip-x" aria-label="Unban {id}" onclick={() => unban(id)}><span class="icon" translate="no" aria-hidden="true">close</span></button></li>
                    {/each}
                </ul>
            {:else}
                <p class="hint">No one is banned.</p>
            {/if}
        </div>

        <form class="inline" onsubmit={(e) => { e.preventDefault(); if (kickTarget.trim()) confirming = "kick"; }}>
            <label class="field">
                <span>Kick by Slack ID <em>signs them out everywhere, no ban</em></span>
                <input class="input mono" bind:value={kickTarget} placeholder="U01ABC234" autocomplete="off" />
            </label>
            {#if confirming === "kick"}
                <div class="confirm" role="group" aria-label="Confirm kick">
                    <p>Sign <strong class="mono">{kickTarget.trim()}</strong> out of every console and big screen? They can sign in again.</p>
                    <button type="button" class="btn btn-small btn-danger" onclick={kick}>Kick</button>
                    <button type="button" class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
                </div>
            {:else}
                <button class="btn btn-small" disabled={!kickTarget.trim()}>Kick…</button>
            {/if}
        </form>
    </section>

    <section class="block">
        <h3>Partial bans</h3>
        <p class="hint">Keep someone signed in but stop them from one thing.</p>
        <form class="inline" onsubmit={(e) => e.preventDefault()}>
            <label class="field">
                <span>Slack ID</span>
                <input class="input mono" bind:value={restrictTarget} placeholder="U01ABC234" autocomplete="off" />
            </label>
            {#each SCOPES as scope}
                <button type="button" class="btn btn-small" disabled={!restrictTarget.trim()} title={scope.sub}
                    onclick={() => restrict(restrictTarget, scope.key, true)}>Ban from {scope.label.toLowerCase()}</button>
            {/each}
        </form>
        <ul class="scopes">
            {#each SCOPES as scope}
                <li><strong>{scope.label}:</strong> {scope.sub}</li>
            {/each}
        </ul>
        <div class="banned">
            <span class="field-label">Restricted ({Object.keys(restrictions).length})</span>
            {#if Object.keys(restrictions).length}
                <ul>
                    {#each Object.entries(restrictions) as [id, scopes] (id)}
                        {#each scopes as scope (scope)}
                            <li><span class="mono">{id}</span><span class="tag">{scopeLabel(scope)}</span><button class="chip-x" aria-label="Lift {scopeLabel(scope)} ban for {id}" onclick={() => restrict(id, scope, false)}><span class="icon" translate="no" aria-hidden="true">close</span></button></li>
                        {/each}
                    {/each}
                </ul>
            {:else}
                <p class="hint">No partial bans.</p>
            {/if}
        </div>
    </section>

    <section class="block">
        <div class="block-head">
            <h3>Events database</h3>
            <button class="btn btn-small btn-quiet" onclick={load} disabled={loading}>
                <span class="icon" translate="no" aria-hidden="true">sync</span>{loading ? "Loading" : "Reload"}
            </button>
        </div>
        <textarea class="input mono json" bind:value={eventsJson} spellcheck="false" aria-invalid={!!jsonError} aria-label="Events database JSON"></textarea>
        {#if jsonError}<p class="error-text">{jsonError}</p>{/if}
        <div class="actions">
            {#if confirming === "save"}
                <span class="confirm-text">Replace the whole database for every event?</span>
                <button class="btn btn-small btn-danger" onclick={save}>Replace</button>
                <button class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
            {:else}
                <button class="btn btn-small btn-primary" disabled={!jsonDirty || !!jsonError} onclick={() => (confirming = "save")}>Save changes…</button>
                <button class="btn btn-small" onclick={() => copy(eventsJson)}>
                    <span class="icon" translate="no" aria-hidden="true">content_copy</span>Copy
                </button>
                <button class="btn btn-small" onclick={download} disabled={!eventsJson}>Download</button>
            {/if}
        </div>
    </section>

    <section class="block">
        <h3>Look up an event</h3>
        <form class="inline" onsubmit={lookup}>
            <label class="field">
                <span>Attendee code</span>
                <input class="input mono" bind:value={lookupCode} inputmode="numeric" placeholder="4821" />
            </label>
            <button class="btn btn-small" disabled={!lookupCode.trim()}>Look up</button>
        </form>
        {#if lookupError}<p class="error-text">{lookupError}</p>{/if}
        {#if lookupResult}
            <textarea class="input mono json short" readonly value={lookupResult} aria-label="Packet JSON"></textarea>
            <div><button class="btn btn-small" onclick={() => copy(lookupResult)}>Copy packet</button></div>
        {/if}
    </section>
</div>

<style>
    .admin { display: grid; gap: 28px; }
    h2 { font-size: 1.3rem; }
    h3 { font-size: 1.05rem; }
    .block { display: grid; gap: 14px; padding-top: 24px; border-top: 1px solid var(--line); }
    .block-head { display: flex; justify-content: space-between; align-items: center; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .inline { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
    .inline .field { flex: 1; min-width: 180px; }
    .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; border-radius: var(--radius-m); background: var(--danger-wash); }
    .confirm p { flex: 1; }
    .confirm-text { font-weight: 700; color: var(--danger); align-self: center; }
    .banned ul { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .banned li { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; border-radius: var(--radius-pill); background: var(--surface-sunken); }
    .chip-x { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; color: var(--ink-2); cursor: pointer; }
    .chip-x:hover { background: var(--line); }
    .banned li.locked { padding-right: 12px; }
    .lock { font-size: 1rem; color: var(--ink-3); }
    .tag { color: var(--ink-3); font-size: 0.85rem; }
    .scopes { margin: 0; padding-left: 18px; color: var(--ink-2); font-size: 0.88rem; display: grid; gap: 2px; }
    .field em { font-style: normal; color: var(--ink-3); font-weight: 400; }
    .json { min-height: 260px; font-size: 0.85rem; }
    .json.short { min-height: 150px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .message { padding: 10px 14px; border-radius: var(--radius-m); font-weight: 700; }
    .message.ok { background: var(--live-wash); color: oklch(0.38 0.1 150); }
    .message.error { background: var(--danger-wash); color: var(--danger); }
    @media (max-width: 720px) { .pair { grid-template-columns: 1fr; } }
</style>
