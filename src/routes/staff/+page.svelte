<script>
    import { resolve } from "$app/paths";
    import { onMount, tick } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { eventName } from "$lib/event";
    import { internal, liveshareData, LIVE_KEYS } from "$lib/liveshare.svelte.js";
    import { announcementsOf } from "$lib/announcements.js";
    import { CONTENT, hydrateDrafts, resetDrafts, applyRemotePacket } from "$lib/console/drafts.svelte.js";
    import { API, org, connectOrgStream, disconnectOrgStream } from "$lib/org.svelte.js";

    import Backdrop from "$lib/components/Backdrop.svelte";
    import Wordmark from "$lib/components/Wordmark.svelte";
    import AttendeeFeed from "$lib/components/AttendeeFeed.svelte";
    import SyncPill from "$lib/console/SyncPill.svelte";
    import ShareCard from "$lib/console/ShareCard.svelte";
    import SetupCard from "$lib/console/SetupCard.svelte";
    import SourceList from "$lib/console/SourceList.svelte";
    import DemoCard from "$lib/console/DemoCard.svelte";
    import HarpaCard from "$lib/console/HarpaCard.svelte";
    import Editor from "$lib/console/Editor.svelte";
    import Toasts from "$lib/console/Toasts.svelte";
    import AdminPanel from "$lib/console/AdminPanel.svelte";
    import Organizers from "$lib/console/Organizers.svelte";



    let ready = $state(false);
    let isAdmin = $state(false);
    let view = $state("event"); // event | admin | organizers
    let renaming = $state(false);
    let selected = $state("announcements");
    let editorEl = $state();
    let now = $state(new Date());

    onMount(() => {
        const clock = setInterval(() => (now = new Date()), 30000);
        init();
        return () => {
            clearInterval(clock);
            disconnectOrgStream();
        };
    });

    let inviteCount = $derived(org.state?.invites?.length ?? 0);
    let bridged = $derived(org.state?.role === "bridged");

    // An organizer of someone else's event shows that event's name, and only its owner can
    // rename it. Joining or leaving switches which event this console publishes to, so its
    // content is reloaded from the server: publishing stale content would wipe the other
    // event's. Leaving goes back to this organizer's own event, or to naming it if it never had
    // a name (joined by invite on first sign-in).
    let lastRoot = null;
    $effect(() => {
        const state = org.state;
        if (!state) return;
        const root = state.root.code;
        if (state.role === "bridged") {
            renaming = false;
            internal.cityName = state.root.cityName || "";
            internal.initComplete = true;
        }
        if (lastRoot !== null && lastRoot !== root) loadPacket({ leaving: state.role !== "bridged", switching: true });
        lastRoot = root;
    });

    // Pulls what attendees see right now (the owner's event, for an organizer) into the console.
    // `switching`: a different event's content, so drafts typed for the old one are dropped.
    async function loadPacket({ leaving = false, switching = false } = {}) {
        let data;
        try {
            const response = await fetch(`${API}/getPacket?code=${encodeURIComponent(internal.code)}`);
            if (!response.ok) return false;
            data = await response.json();
        } catch {
            return false;
        }
        if (data.cityName?.trim()) {
            internal.cityName = data.cityName;
            internal.initComplete = true;
            localStorage.setItem("cityName", data.cityName);
        } else if (leaving) {
            internal.cityName = "";
            internal.initComplete = false;
            localStorage.removeItem("cityName");
            if (view === "organizers") view = "event";   // the tab hides until it's named
        }
        let synced = null;
        try { synced = typeof data.data === "string" ? JSON.parse(data.data) : data.data; } catch {}
        if (switching) resetDrafts();
        for (const key of LIVE_KEYS) {
            liveshareData[key] = (synced && synced[key]) || null;
        }
        // Packets from before announcements were a list carry just one.
        const announcements = announcementsOf(synced);
        liveshareData.announcements = announcements.length ? announcements : null;
        if (synced) {
            hydrateDrafts();
            internal.importedSync = true;
        }
        return true;
    }

    async function init() {
        let creds;
        try {
            creds = JSON.parse(localStorage.getItem("creds"));
        } catch {
            creds = null;
        }
        if (!Array.isArray(creds)) {
            window.location.replace(resolve("/"));
            return;
        }

        [internal.code, internal.slack, internal.name, internal.password] = creds;
        if (creds[4]) {
            try { internal.sources = JSON.parse(creds[4]); } catch { internal.sources = []; }
        }

        // Live organizer state (invites, joins, removals, admin resets) for this console
        connectOrgStream({ onSignOut: signOut, onPacket: applyRemotePacket, onReconnect: refreshContent });

        // Always pull the live packet so the console reflects what attendees see right now.
        // Offline: fall back to the name saved on this device (below).
        await loadPacket();
        if (!internal.initComplete && localStorage.getItem("cityName")) {
            internal.cityName = localStorage.getItem("cityName");
            internal.initComplete = true;
        }

        // Open on whatever is already showing, so the first screen is the one most likely to change.
        selected = CONTENT.find((c) => liveshareData[c.key])?.key ?? "announcements";
        ready = true;

        try {
            const res = await fetch(`${API}/getAdmins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: internal.code, password: internal.password })
            });
            const data = await res.json();
            isAdmin = Array.isArray(data.admins) && data.admins.includes(internal.slack);
            console.log((isAdmin ? "Is Admin" : "Is not admin"));
        } catch {
            isAdmin = false;
        }
    }

    // After the stream drops, catch up on anything other organizers published meanwhile.
    async function refreshContent() {
        try {
            const response = await fetch(`${API}/getPacket?code=${encodeURIComponent(internal.code)}`);
            if (response.ok) applyRemotePacket((await response.json()).data);
        } catch {
            // The next reconnect tries again.
        }
    }

    async function select(key, { focus = false } = {}) {
        selected = key;
        await tick();
        // On a single-column layout the editor sits below the list; bring it into view.
        if (window.matchMedia("(max-width: 760px)").matches) {
            editorEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (focus) editorEl?.querySelector("input, textarea")?.focus({ preventScroll: true });
    }

    function signOut() {
        disconnectOrgStream();
        localStorage.removeItem("creds");
        localStorage.removeItem("cityName");
        window.location.replace(resolve("/"));
    }
</script>

<svelte:head>
    <title>Organizer Console · Jumbotron</title>
</svelte:head>

<Backdrop trees={false} scrim={0.35} />

<div class="shell">
    <header class="topbar">
        <div class="brand">
            <Wordmark onArt size="s" />
            <span class="product">Organizer Console</span>
        </div>

        {#if isAdmin || internal.initComplete}
            <div class="view-switch" role="group" aria-label="Console view">
                <button aria-pressed={view === "event"} onclick={() => (view = "event")}>Event</button>
                {#if internal.initComplete}
                    <button aria-pressed={view === "organizers"} onclick={() => (view = "organizers")}>
                        Organizers{#if inviteCount}<span class="count-badge" aria-label="{inviteCount} invites waiting">{inviteCount}</span>{/if}
                    </button>
                {/if}
                {#if isAdmin}
                    <button aria-pressed={view === "admin"} onclick={() => (view = "admin")}>Admin</button>
                {/if}
            </div>
        {:else}
            <span></span>
        {/if}

        <div class="account">
            {#if internal.slack}
                <img src="https://cachet.hackclub.com/users/{internal.slack}/r" alt="" width="32" height="32" />
            {/if}
            <span class="name">{internal.name ?? ""}</span>
            <button class="btn btn-small btn-on-art" onclick={signOut}>
                <span class="icon" translate="no" aria-hidden="true">logout</span>Sign out
            </button>
        </div>
    </header>

    {#if ready && (org.notice || (org.state?.role === "bridged" && view === "event"))}
        <div class="notices">
            {#if org.notice}
                <p class="notice" role="status" transition:slide={{ duration: 200 }}>{org.notice}</p>
            {/if}
            {#if org.state?.role === "bridged" && view === "event"}
                <p class="notice" transition:slide={{ duration: 200 }}>
                    You're an organizer of <strong>{org.state.root.name}</strong>'s event. Everything here is shared with them.
                </p>
            {/if}
        </div>
    {/if}

    {#if !ready}
        <p class="loading" role="status" in:fade>Loading your event</p>
    {:else if view === "admin"}
        <main class="single" in:fade={{ duration: 150 }}>
            <div class="panel"><AdminPanel /></div>
        </main>
    {:else if view === "organizers"}
        <main class="single" in:fade={{ duration: 150 }}>
            <div class="panel"><Organizers /></div>
        </main>
    {:else}
        <section class="hero" in:fade={{ duration: 150 }}>
            <div class="title-block">
                {#if internal.initComplete}
                <h1>{eventName}{internal.initComplete ? ` ${internal.cityName}` : ""}</h1>
                    <div class="meta">
                        <SyncPill />
                        {#if !bridged}
                            <button class="btn btn-small btn-on-art" onclick={() => (renaming = !renaming)} aria-expanded={renaming}>
                                {renaming ? "Cancel rename" : "Rename event"}
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>
            {#if internal.initComplete}<ShareCard />{/if}
        </section>

        {#if (!internal.initComplete && !bridged) || (renaming && !bridged)}
            <div class="panel narrow" transition:slide={{ duration: 220 }}>
                {#if renaming}
                    <SetupCard oncancel={() => (renaming = false)} ondone={() => (renaming = false)} />
                {:else}
                    <SetupCard />
                {/if}
            </div>
        {/if}

        {#if internal.initComplete}
            <main class="workspace" in:fade={{ duration: 150 }}>
                <div class="panel pane-list">
                    <SourceList {selected} onselect={select} />
                    <DemoCard />
                    <HarpaCard />
                </div>

                <div class="panel pane-editor" bind:this={editorEl}>
                    {#key selected}
                        <div in:fade={{ duration: 140 }}><Editor key={selected} /></div>
                    {/key}
                </div>

                <aside class="pane-preview" aria-label="Attendee preview">
                    <p style:margin-bottom=20px class="preview-label">What attendees see</p>
                    <div class="device">
                        <p class="device-title">{eventName} {internal.cityName}</p>
                        <AttendeeFeed data={liveshareData} {now} compact />
                    </div>
                </aside>
            </main>
        {/if}
    {/if}
</div>

<Toasts />

<style>
    .shell { min-height: 100dvh; padding: 0 24px 96px; }

    /* Brand left, view switch centered, account right */
    .topbar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px 20px;
        max-width: 1440px;
        margin: 0 auto;
        padding: 16px 0;
        color: var(--on-art);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .product { padding-left: 12px; border-left: 1px solid rgb(255 255 255 / 0.4); font-size: 1rem; font-weight: 700; line-height: 1.2; opacity: 0.9; }
    .account { justify-self: end; display: flex; align-items: center; gap: 10px; }
    .account img { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-sunken); }
    .name { font-weight: 700; }

    .view-switch {
        display: inline-flex;
        padding: 4px;
        border-radius: var(--radius-pill);
        background: rgb(20 24 32 / 0.55);
    }
    .view-switch button {
        min-height: 34px;
        padding: 0 18px;
        border: 0;
        border-radius: var(--radius-pill);
        background: none;
        color: var(--on-art);
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
    }
    .view-switch button[aria-pressed="true"] { background: var(--surface); color: var(--ink); }
    .count-badge {
        display: inline-grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        margin-left: 6px;
        padding: 0 5px;
        border-radius: var(--radius-pill);
        background: var(--red);
        color: var(--on-color);
        font-size: 0.72rem;
    }

    .notices { display: grid; gap: 8px; max-width: 1440px; margin: 0 auto 8px; }
    .notice {
        padding: 12px 16px;
        border-radius: var(--radius-m);
        background: var(--yellow);
        color: var(--ink);
        font-weight: 700;
    }

    .loading { margin-top: 30vh; text-align: center; color: var(--on-art); font-weight: 700; }

    /* Event title on the art, attendee code beside it */
    .hero {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px 32px;
        max-width: 1440px;
        margin: 20px auto 28px;
    }
    .title-block { display: grid; gap: 12px; }
    h1 {
        color: var(--on-art);
        font-family: var(--font-display);
        font-weight: 400;
        font-size: clamp(2.6rem, 6vw, 4.4rem);
        line-height: 1;
        text-shadow: 0 2px 18px rgb(20 24 32 / 0.45);
    }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }

    .panel {
        padding: 24px;
        border-radius: var(--radius-l);
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-2);
    }
    .panel.narrow { max-width: 560px; margin: 0 auto 24px; }

    /* Pick on the left, edit in the middle, see the result on the right */
    .workspace {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr) 360px;
        gap: 20px;
        align-items: start;
        max-width: 1440px;
        margin: 0 auto;
    }
    .pane-list { padding: 18px 12px; }
    .pane-editor { padding: 28px 32px; min-height: 420px; }

    .pane-preview { position: sticky; top: 16px; }
    .preview-label { margin: 0 0 10px 6px; color: var(--on-art); font-weight: 700; font-size: 0.9rem; }
    .device {
        max-height: calc(100dvh - 72px);
        overflow: auto;
        padding: 20px 14px;
        border-radius: 36px;
        background: var(--bg);
        box-shadow: 0 0 0 9px oklch(0.13 0.02 150), 0 0 0 10px var(--line), var(--shadow-2);
    }
    .device-title { margin-bottom: 14px; text-align: center; font-family: var(--font-display); font-size: 1.4rem; color: var(--ink); }

    .single { max-width: 920px; margin: 24px auto 0; }

    @media (max-width: 1180px) {
        .workspace { grid-template-columns: 300px minmax(0, 1fr); }
        .pane-preview { grid-column: 1 / -1; position: static; justify-self: center; width: min(420px, 100%); }
        .device { max-height: none; }
    }
    @media (max-width: 760px) {
        .shell { padding: 0 16px 96px; }
        .topbar { grid-template-columns: 1fr auto; }
        .view-switch { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
        .workspace { grid-template-columns: minmax(0, 1fr); }
        .pane-editor { padding: 22px 18px; min-height: 0; scroll-margin-top: 16px; }
        .name, .product { display: none; }
        .hero { margin-top: 8px; }
    }
</style>
