<script>
    // Organizers: the people who run this event together, like sharing a doc. Anyone here can
    // add people by Slack member ID; once they accept, everyone shares one attendee code, one
    // big screen, one demo queue and the same content. (Underneath, each organizer's own event
    // points at the owner's: see mergeState() in the backend.)
    import { slide } from "svelte/transition";
    import { resolve } from "$app/paths";
    import { internal } from "$lib/liveshare.svelte";
    import { org, sendInvite, cancelInvite, removeMember, leaveMerge, showNotice, deleteEvent, disconnectOrgStream } from "$lib/org.svelte.js";
    import InvitesReceived from "./InvitesReceived.svelte";

    let message = $state("");
    let error = $state("");
    let busy = $state(false);

    let state = $derived(org.state);
    let isOwner = $derived(state?.role === "root");
    let members = $derived(state?.members ?? []);
    let invitesSent = $derived(state?.invitesSent ?? []);
    let peopleCount = $derived(state ? 1 + members.length : 0);

    // Wraps every action: one in flight at a time, errors and success copy surfaced inline.
    // Resulting state changes arrive through org.state (POST response + /orgStream push).
    async function run(action, successText) {
        if (busy) return;
        busy = true;
        error = "";
        message = "";
        try {
            await action();
            message = successText;
        } catch (err) {
            error = err.message || "Network error, please try again.";
        } finally {
            busy = false;
        }
    }

    // Add box: type or paste one or more Slack member IDs (or profile links), like adding people
    // to a shared doc. Each one is invited as soon as it's added.
    let addText = $state("");
    let addInput = $state();

    function slackIdsIn(text) {
        const found = String(text).toUpperCase().match(/\b[UW](?=[A-Z0-9]*\d)[A-Z0-9]{6,15}\b/g) || [];
        return [...new Set(found)];
    }

    async function add() {
        const ids = slackIdsIn(addText);
        if (!ids.length) {
            error = addText.trim()
                ? "That doesn't look like a Slack member ID. They start with U, like U0123ABCD."
                : "Type a Slack member ID first.";
            return;
        }
        await run(async () => {
            const failed = [];
            for (const id of ids) {
                try {
                    await sendInvite(id);
                } catch (e) {
                    failed.push({ id, text: `${id}: ${e.message}` });
                }
            }
            if (failed.length) {
                addText = failed.map((f) => f.id).join(", ");
                throw new Error(failed.map((f) => f.text).join(" "));
            }
            addText = "";
        }, ids.length === 1 ? "Invite sent. They'll see it in their console." : `${ids.length} invites sent.`);
        addInput?.focus();
    }

    // Destructive actions confirm inline: `confirming` holds a member code, or "leave".
    let confirming = $state(null);

    function remove(member) {
        confirming = null;
        run(() => removeMember(member.code), `${member.name} is no longer an organizer.`);
    }

    // Leaving can send the console to "Name your event" and close this panel, so the outcome
    // goes in the console-wide notice too.
    async function leave() {
        confirming = null;
        await run(leaveMerge, "You left. You're back on your own event.");
        if (!error) showNotice("You left. You're back on your own event.");
    }

    // Deleting is permanent: the event's code, name and content go, other organizers go back to
    // their own events, and this console signs out (signing in again starts a fresh event).
    async function removeEvent() {
        confirming = null;
        await run(deleteEvent, "");
        if (error) return;
        disconnectOrgStream();
        localStorage.removeItem("creds");
        localStorage.removeItem("cityName");
        window.location.replace(resolve("/"));
    }

    const avatar = (slack) => `https://cachet.hackclub.com/users/${slack}/r`;
    const you = (code) => code === internal.code;
</script>

<div class="organizers">
    <div class="head">
        <div>
            <h2>Organizers</h2>
            <p class="hint">Everyone here runs this event together: same attendee code, same big screen, same demo queue. Anyone can publish.</p>
        </div>
        <span class="conn" class:offline={!org.connected} role="status">
            <span class="dot" aria-hidden="true"></span>{org.connected ? "Connected" : "Reconnecting"}
        </span>
    </div>

    {#if error}
        <p class="message error" role="alert" transition:slide={{ duration: 200 }}>{error}</p>
    {/if}
    {#if message}
        <p class="message ok" role="status" transition:slide={{ duration: 200 }}>{message}</p>
    {/if}

    {#if !state && org.error}
        <p class="message error" role="alert">{org.error} Retrying automatically.</p>
    {:else if !state}
        <p class="hint">Loading organizers</p>
    {:else}
        {#if state.invites?.length}
            <section class="block"><InvitesReceived heading="Invites to organize another event" /></section>
        {/if}

        <section class="block">
            <h3>Add organizers</h3>
            <form class="add" onsubmit={(e) => { e.preventDefault(); add(); }}>
                <label class="sr-only" for="add-ids">Slack member IDs</label>
                <input
                    id="add-ids"
                    class="input"
                    bind:this={addInput}
                    bind:value={addText}
                    placeholder="U0123ABCD, U0456EFGH"
                    autocomplete="off"
                    autocapitalize="characters"
                    spellcheck="false"
                />
                <button class="btn btn-primary" disabled={busy || !addText.trim()}>Add</button>
            </form>
            <p class="hint">
                Use their Slack member ID: in Slack, open their profile, then ⋯, then Copy member ID.
                People who haven't opened Jumbotron yet see the invite when they sign in.
            </p>
        </section>

        <section class="block">
            <h3>People with access <span class="count">{peopleCount + invitesSent.length}</span></h3>
            <ul class="people">
                <li>
                    <img src={avatar(state.root.slack)} alt="" />
                    <span class="who">
                        <strong>{state.root.name}{you(state.root.code) ? " (you)" : ""}</strong>
                        <span class="sub">Owner</span>
                    </span>
                </li>
                {#each members as m (m.code)}
                    <li transition:slide={{ duration: 200 }}>
                        <img src={avatar(m.slack)} alt="" />
                        <span class="who">
                            <strong>{m.name}{you(m.code) ? " (you)" : ""}</strong>
                            <span class="sub">Organizer</span>
                        </span>
                        {#if you(m.code)}
                            {#if confirming === "leave"}
                                <span class="row-confirm">
                                    <button class="btn btn-small btn-danger" onclick={leave} disabled={busy}>Leave</button>
                                    <button class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
                                </span>
                            {:else}
                                <button class="btn btn-small btn-destructive" onclick={() => (confirming = "leave")} disabled={busy}>Leave…</button>
                            {/if}
                        {:else if isOwner}
                            {#if confirming === m.code}
                                <span class="row-confirm">
                                    <button class="btn btn-small btn-danger" onclick={() => remove(m)} disabled={busy}>Remove</button>
                                    <button class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
                                </span>
                            {:else}
                                <button class="btn btn-small btn-destructive" onclick={() => (confirming = m.code)} disabled={busy}
                                    aria-label={`Remove ${m.name}`}>Remove…</button>
                            {/if}
                        {/if}
                    </li>
                {/each}
                {#each invitesSent as inv (inv.slack)}
                    <li class="pending" transition:slide={{ duration: 200 }}>
                        <img src={avatar(inv.slack)} alt="" />
                        <span class="who">
                            <strong>{inv.name ?? inv.slack}</strong>
                            <span class="sub">{inv.code ? "Invited, hasn't accepted yet" : "Invited, hasn't opened Jumbotron yet"}</span>
                        </span>
                        <button class="btn btn-small btn-quiet" disabled={busy} onclick={() => run(() => cancelInvite(inv.slack), "Invite cancelled.")}
                            aria-label={`Cancel invite to ${inv.name ?? inv.slack}`}>Cancel invite</button>
                    </li>
                {/each}
            </ul>
            {#if confirming === "leave"}
                <p class="hint">You go back to your own event and code. Its attendees stop seeing this event.</p>
            {:else if isOwner && members.length}
                <p class="hint">Removed organizers go back to their own event.</p>
            {/if}
        </section>

        {#if isOwner}
            <section class="block">
                <h3>Delete event</h3>
                <p class="hint">Removes this event's attendee code, name and everything posted. Attendees are disconnected, other organizers go back to their own events, and you're signed out. This can't be undone.</p>
                <div>
                    {#if confirming === "delete"}
                        <span class="row-confirm">
                            <button class="btn btn-small btn-danger" onclick={removeEvent} disabled={busy}>Delete for good</button>
                            <button class="btn btn-small btn-quiet" onclick={() => (confirming = null)}>Cancel</button>
                        </span>
                    {:else}
                        <button class="btn btn-small btn-destructive" onclick={() => (confirming = "delete")} disabled={busy}>Delete event…</button>
                    {/if}
                </div>
            </section>
        {/if}
    {/if}
</div>

<style>
    .organizers { display: grid; gap: 24px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    h2 { font-size: 1.3rem; }
    h3 { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; }
    .hint { margin-top: 4px; }
    .count { padding: 1px 9px; border-radius: var(--radius-pill); background: var(--surface-sunken); color: var(--ink-2); font-size: 0.8rem; }

    .conn {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        background: var(--live-wash);
        color: oklch(0.38 0.1 150);
        font-size: 0.85rem;
        font-weight: 700;
    }
    .conn .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--live); }
    .conn.offline { background: var(--accent-wash); color: var(--ink-2); }
    .conn.offline .dot { background: var(--accent-strong); }

    .block { display: grid; gap: 10px; padding-top: 22px; border-top: 1px solid var(--line); }

    .add { display: flex; flex-wrap: wrap; gap: 8px; }
    .add .input { flex: 1 1 240px; min-width: 0; font-family: var(--font-mono); }

    .people { list-style: none; margin: 4px 0 0; padding: 0; }
    .people li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
    .people li:first-child { border-top: 0; }
    .people img { flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--surface-sunken); object-fit: cover; }
    .pending img { opacity: 0.6; }
    .who { flex: 1; min-width: 0; display: grid; }
    .sub { color: var(--ink-3); font-size: 0.88rem; }
    .row-confirm { display: inline-flex; gap: 6px; }

    .message { padding: 10px 14px; border-radius: var(--radius-m); font-weight: 700; }
    .message.ok { background: var(--live-wash); color: oklch(0.38 0.1 150); }
    .message.error { background: var(--danger-wash); color: var(--danger); }
</style>
