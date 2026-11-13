<script>
    // Middle pane of the console: edit one kind of content, then publish it.
    import { slide } from "svelte/transition";
    import { liveshareData, syncStatus, takeDown, removeAnnouncement } from "$lib/liveshare.svelte.js";
    import { CONTENT, drafts, buildValue, draftError, rowStatus, isDirty, publishDraft, editAnnouncement, clearAnnouncementDraft } from "./drafts.svelte.js";
    import { formatClock, relativeToNow } from "$lib/time.js";
    import { stampOf } from "$lib/announcements.js";

    let { key } = $props();

    let item = $derived(CONTENT.find((c) => c.key === key));
    let live = $derived(!!liveshareData[key]);
    let status = $derived(rowStatus(key));
    let error = $derived(draftError(key));
    let busy = $derived(syncStatus.state === "syncing");

    const STATUS = { live: "Showing now", edited: "Edited, not published", draft: "Not showing yet", "": "Not showing" };
    const ANNOUNCEMENT_STATUS = { ...STATUS, edited: "Draft not posted" };

    let posted = $derived(key === "announcements" ? liveshareData.announcements || [] : []);
    let editing = $derived(key === "announcements" ? drafts.announcements.editing : null);
    let headline = $state();

    async function onPublish() {
        await publishDraft(key);
    }

    function startEdit(item) {
        editAnnouncement(item);
        headline?.focus();
    }
</script>

<section class="editor" style:--c={item.color} aria-labelledby="editor-heading">
    <header>
        <span class="swatch icon" class:live translate="no" aria-hidden="true">{item.icon}</span>
        <div class="titles">
            <h2 id="editor-heading">{item.label}</h2>
            <p class="hint">{item.hint}</p>
        </div>
        <span class="state {status}">{(key === "announcements" ? ANNOUNCEMENT_STATUS : STATUS)[status]}</span>
    </header>

    <div class="fields">
        {#if key === "announcements"}
            {#if editing}
                <p class="edit-note" transition:slide={{ duration: 160 }}>
                    <span class="icon" translate="no" aria-hidden="true">edit</span>Editing a posted announcement. Attendees see it marked as updated.
                </p>
            {/if}
            <label class="field">
                <span>Headline</span>
                <input class="input big" bind:this={headline} bind:value={drafts.announcements.title} placeholder="Lunch is ready" maxlength="120" />
            </label>
            <label class="field">
                <span>Details <em>optional</em></span>
                <textarea class="input" rows="4" bind:value={drafts.announcements.message} placeholder="Pizza in the main hall. Vegan options on the left table." maxlength="600"></textarea>
            </label>
            <p class="hint">Plain words work best with screen readers. Skip emoji and ASCII art.</p>

        {:else if key === "event"}
            <label class="field">
                <span>What's happening</span>
                <input class="input big" bind:value={drafts.event.title} placeholder="Demo presentations" maxlength="120" />
            </label>
            <div class="time-row">
                <label class="field">
                    <span>Starts at</span>
                    <input class="input time" type="time" bind:value={drafts.event.at} />
                </label>
                <fieldset class="segmented">
                    <legend class="field-label">Clock format</legend>
                    <div>
                        <label><input type="radio" name="hour-format" value={true} bind:group={drafts.event.hour12} /><span><strong>12-hour</strong><small>{formatClock(drafts.event.at, true) || "3:30 PM"}</small></span></label>
                        <label><input type="radio" name="hour-format" value={false} bind:group={drafts.event.hour12} /><span><strong>24-hour</strong><small>{formatClock(drafts.event.at, false) || "15:30"}</small></span></label>
                    </div>
                </fieldset>
            </div>
            {#if drafts.event.at}
                <p class="hint">Attendees see <strong>{formatClock(drafts.event.at, drafts.event.hour12)}</strong> with a countdown ({relativeToNow(drafts.event.at)}).</p>
            {/if}

        {:else if key === "file"}
            <label class="field">
                <span>Google Drive link</span>
                <input class="input" type="url" bind:value={drafts.file} placeholder="https://docs.google.com/presentation/d/…" aria-invalid={!!error} />
            </label>
            <p class="hint">In Google Drive, open Share, set access to “Anyone with the link”, then Copy link. Attendees get a read-only preview without your speaker notes or comments.</p>

        {:else if key === "youtube"}
            <label class="field">
                <span>YouTube link</span>
                <input class="input" type="url" bind:value={drafts.youtube} placeholder="https://www.youtube.com/watch?v=…" aria-invalid={!!error} />
            </label>

        {:else if key === "website"}
            <label class="field">
                <span>Web address</span>
                <input class="input" type="url" bind:value={drafts.website} placeholder="forms.hackclub.com/…" aria-invalid={!!error} />
            </label>
        {/if}

        {#if error}<p class="error-text" role="alert">{error}</p>{/if}
    </div>

    <footer>
        {#if key === "announcements"}
            <button class="btn btn-primary" disabled={busy || !buildValue(key)} onclick={onPublish}>{editing ? "Save changes" : "Post announcement"}</button>
            {#if editing}
                <button class="btn btn-quiet" onclick={clearAnnouncementDraft}>Cancel edit</button>
            {:else if live}
                <button class="btn btn-destructive" disabled={busy} onclick={() => takeDown(key, item.label)}>Take all down</button>
            {/if}
        {:else if live}
            <button class="btn btn-primary" disabled={busy || !isDirty(key) || !buildValue(key)} onclick={onPublish}>Update</button>
            <button class="btn btn-destructive" disabled={busy} onclick={() => takeDown(key, item.label)}>Take down</button>
        {:else}
            <button class="btn btn-primary" disabled={busy || !buildValue(key)} onclick={onPublish}>Show to attendees</button>
        {/if}
    </footer>

    {#if key === "announcements" && posted.length}
        <section class="posted" aria-labelledby="posted-heading">
            <h3 id="posted-heading">Posted <span class="count">{posted.length}</span></h3>
            <p class="hint">Newest first. Attendees see all of these; the big screen shows the newest.</p>
            <ul>
                {#each posted as a (a.id)}
                    {@const stamp = stampOf(a)}
                    <li class:editing={a.id === editing} transition:slide={{ duration: 180 }}>
                        <div class="post-text">
                            {#if a.title}<strong>{a.title}</strong>{/if}
                            {#if a.message}<p>{a.message}</p>{/if}
                            {#if stamp}<span class="stamp">{stamp.verb} <time datetime={stamp.iso}>{stamp.text}</time></span>{/if}
                        </div>
                        <div class="post-actions">
                            <button class="btn btn-small" disabled={busy || a.id === editing} onclick={() => startEdit(a)}>Edit</button>
                            <button class="btn btn-small btn-destructive" disabled={busy} onclick={() => removeAnnouncement(a.id)}
                                aria-label={`Remove “${a.title || a.message}”`}>Remove</button>
                        </div>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}
</section>

<style>
    .editor { display: grid; gap: 24px; }

    header { display: flex; align-items: center; gap: 16px; }
    .swatch {
        flex: none;
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: var(--surface-sunken);
        color: var(--c);
        font-size: 1.7rem;
    }
    .swatch.live { background: var(--c); color: var(--on-color); }
    .titles { flex: 1; min-width: 0; }
    h2 { font-size: 1.5rem; letter-spacing: -0.01em; }
    .titles .hint { margin-top: 2px; }

    .state {
        flex: none;
        padding: 4px 12px;
        border-radius: var(--radius-pill);
        background: var(--surface-sunken);
        color: var(--ink-3);
        font-size: 0.82rem;
        font-weight: 700;
    }
    .state.live { background: var(--c); color: var(--on-color); }
    .state.edited { background: var(--accent-wash); color: var(--orange-ink); }

    .fields { display: grid; gap: 16px; max-width: 640px; }
    .big { font-size: 1.2rem; font-weight: 700; }
    em { font-style: normal; font-weight: 400; color: var(--ink-3); }

    .time-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; }
    .time { width: 11rem; font-family: var(--font-mono); }

    .segmented { border: 0; margin: 0; padding: 0; display: grid; gap: 6px; }
    .segmented legend { padding: 0; margin-bottom: 6px; }
    /* Two clearly separate choices; the picked one fills with the row's color */
    .segmented > div { display: inline-flex; gap: 6px; }
    .segmented label { position: relative; cursor: pointer; }
    .segmented input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
    .segmented span {
        display: grid;
        gap: 1px;
        min-width: 7.5rem;
        padding: 7px 14px;
        border: 1.5px solid var(--line-strong);
        border-radius: var(--radius-s);
        background: var(--surface);
        color: var(--ink-2);
        transition: background-color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out);
    }
    .segmented strong { font-size: 0.92rem; }
    .segmented small { font: 700 0.82rem/1.3 var(--font-mono); color: var(--ink-3); }
    .segmented label:hover span { border-color: var(--c); }
    .segmented input:checked + span { border-color: var(--c); background: var(--c); color: var(--on-color); }
    .segmented input:checked + span small { color: var(--on-color); opacity: 0.85; }
    .segmented input:focus-visible + span { outline: 3px solid var(--focus); outline-offset: 2px; }

    .edit-note { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--radius-m); background: var(--accent-wash); font-weight: 700; font-size: 0.92rem; }

    .posted { display: grid; gap: 8px; padding-top: 22px; border-top: 1px solid var(--line); }
    .posted h3 { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; }
    .posted .count { padding: 1px 9px; border-radius: var(--radius-pill); background: var(--surface-sunken); color: var(--ink-2); font-size: 0.8rem; }
    .posted ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 6px; }
    .posted li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: var(--radius-m); background: var(--surface-raised); }
    .posted li.editing { box-shadow: inset 0 0 0 2px var(--c); }
    .post-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .post-text p { color: var(--ink-2); font-size: 0.92rem; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
    .stamp { color: var(--ink-3); font-size: 0.82rem; }
    .post-actions { flex: none; display: flex; gap: 6px; }

    footer { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 20px; border-top: 1px solid var(--line); }

    @media (max-width: 560px) {
        header { flex-wrap: wrap; align-items: flex-start; }
        .titles { flex: 1 1 calc(100% - 60px); }
        .state { margin-left: 60px; }
        .swatch { width: 44px; height: 44px; font-size: 1.45rem; border-radius: 13px; }
        h2 { font-size: 1.3rem; }
    }
</style>
