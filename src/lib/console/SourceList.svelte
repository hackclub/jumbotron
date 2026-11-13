<script>
    // Left pane of the console: every kind of content, whether it's on attendee screens,
    // and a switch to show or hide it. Selecting a row opens it in the editor.
    import { liveshareData, syncStatus, takeDown, showHiddenAnnouncements } from "$lib/liveshare.svelte.js";
    import { CONTENT, buildValue, rowStatus, liveSummary, publishDraft } from "./drafts.svelte.js";
    import Switch from "$lib/components/Switch.svelte";

    let { selected, onselect } = $props();

    let busy = $derived(syncStatus.state === "syncing");
    let liveCount = $derived(CONTENT.filter((c) => liveshareData[c.key]).length);

    // Announcements switched off with the sidebar are kept, not deleted.
    const hiddenCount = (key) => (key === "announcements" && !liveshareData.announcements ? liveshareData.announcementsHidden?.length ?? 0 : 0);

    function statusText(key) {
        const hidden = hiddenCount(key);
        if (hidden && rowStatus(key) === "") return `Switched off, ${hidden} saved`;
        switch (rowStatus(key)) {
            case "live": return liveSummary(key);
            case "edited": return key === "announcements" ? "Draft not posted yet" : "Edited, not published yet";
            case "draft": return "Ready to show";
            default: return "Nothing added yet";
        }
    }

    // Turning on a row with nothing filled in opens its editor instead, with the cursor in the
    // first field, so the switch never looks stuck.
    function toggle(item, on) {
        if (!on) return takeDown(item.key, item.label);
        if (buildValue(item.key)) publishDraft(item.key);
        else if (hiddenCount(item.key)) showHiddenAnnouncements();
        else onselect(item.key, { focus: true });
    }
</script>

<nav class="sources" aria-labelledby="sources-heading">
    <div class="head">
        <h2 id="sources-heading">On screen</h2>
        <span class="count">{liveCount} of {CONTENT.length} showing</span>
    </div>

    <ul>
        {#each CONTENT as item (item.key)}
            {@const live = !!liveshareData[item.key]}
            {@const status = rowStatus(item.key)}
            <li class:selected={selected === item.key} class:live style:--c={item.color}>
                <button class="pick" aria-current={selected === item.key ? "true" : undefined} onclick={() => onselect(item.key)}>
                    <span class="swatch icon" translate="no" aria-hidden="true">{item.icon}</span>
                    <span class="text">
                        <span class="label">{item.label}</span>
                        <span class="sub" class:edited={status === "edited"}>{statusText(item.key)}</span>
                    </span>
                </button>
                <Switch
                    checked={live}
                    label="Show {item.label} to attendees"
                    disabled={busy}
                    hidden={!live && !buildValue(item.key) && !hiddenCount(item.key)}
                    onchange={(on) => toggle(item, on)}
                />
            </li>
        {/each}
    </ul>

    <!-- <p class="hint">Flip a switch to show or hide something. Closing this tab won't change what attendees see.</p> -->
</nav>

<style>
    .sources { display: grid; gap: 12px; align-content: start; }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 6px; }
    h2 { font-size: 1.15rem; }
    .count { color: var(--ink-3); font-size: 0.85rem; }

    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 4px 4px;
        border-radius: var(--radius-m);
        transition: background-color var(--dur-1) var(--ease-out);
    }
    li:hover { background: var(--surface-raised); }
    li.selected { background: var(--surface-raised); box-shadow: inset 0 0 0 1.5px var(--line-strong); }

    .pick {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border: 0;
        border-radius: var(--radius-s);
        background: none;
        color: var(--ink);
        text-align: left;
        cursor: pointer;
    }
    .swatch {
        flex: none;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--surface-sunken);
        color: var(--c);
        font-size: 1.3rem;
        transition: background-color var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out);
    }
    li.live .swatch { background: var(--c); color: var(--on-color); }
    .text { min-width: 0; display: grid; }
    .label { font-weight: 700; }
    .sub { color: var(--ink-3); font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li.live .sub { color: var(--ink-2); }
    .sub.edited { color: var(--orange-ink); }

</style>
