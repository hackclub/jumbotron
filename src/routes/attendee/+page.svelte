<script>
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { eventName } from "$lib/event";
    import { onMount } from "svelte";
    import Backdrop from "$lib/components/Backdrop.svelte";
    import Wordmark from "$lib/components/Wordmark.svelte";
    import AttendeeFeed from "$lib/components/AttendeeFeed.svelte";
    import ShareScreen from "$lib/components/ShareScreen.svelte";
    import DemoMirror from "$lib/components/DemoMirror.svelte";
    import { API } from "$lib/org.svelte.js";
    import { announcementsOf } from "$lib/announcements.js";

    const KEYS = ["announcements", "event", "file", "youtube", "website"];

    let missing = $state(false);
    let cityName = $state("");
    let code = $state("");
    let demos = $state(false); // organizers have turned on demo time
    let mirror = $state(null); // { name, n }: the presenter's screen, mirrored from the big screen
    let presenting = $state(false); // this device is the one sharing: don't mirror it back
    let connection = $state("connecting"); // connecting | live | reconnecting | offline
    let changed = $state([]);
    let now = $state(new Date());

    let liveshareData = $state({ announcements: null, event: null, file: null, youtube: null, website: null });

    let source = null;
    let changedTimer = null;
    let seen = false;   // the first state this page gets is just what's there, not "new"

    function parsePacket(rawPacket, { quiet = false } = {}) {
        if (!rawPacket) return;
        let parsed;
        try {
            parsed = typeof rawPacket === "string" ? JSON.parse(rawPacket) : rawPacket;
        } catch {
            return;
        }
        if (!parsed) return;

        const updated = [];
        // Packets from before announcements were a list carry a single `announcement`.
        const list = announcementsOf(parsed);
        parsed = { ...parsed, announcements: list.length ? list : null };

        const newest = (l) => JSON.stringify(l?.[0] ?? null);
        for (const key of KEYS) {
            const next = parsed[key] || null;
            if (JSON.stringify(next) !== JSON.stringify(liveshareData[key])) {
                // Removing an older announcement isn't news; a new or edited newest one is.
                const fresh = key !== "announcements" || newest(next) !== newest(liveshareData[key]);
                if (next && fresh) updated.push(key);
                liveshareData[key] = next;
            }
        }

        if (!quiet && updated.length) {
            // Screen readers hear the changed items themselves: the feed is a live region.
            changed = updated;
            clearTimeout(changedTimer);
            changedTimer = setTimeout(() => (changed = []), 6000);
        }
    }

    function connect() {
        source?.close();
        connection = connection === "live" ? "reconnecting" : "connecting";
        source = new EventSource(`${API}/getSession?code=${encodeURIComponent(code)}`, { withCredentials: true });

        source.onopen = () => (connection = "live");
        source.onerror = () => {
            connection = source.readyState === EventSource.CLOSED ? "offline" : "reconnecting";
        };
        source.onmessage = (event) => {
            connection = "live";
            try {
                const payload = JSON.parse(event.data);
                if (payload.cityName) cityName = payload.cityName;
                demos = !!payload.demos;
                mirror = payload.mirror ?? null;
                parsePacket(payload.data, { quiet: !seen });
                seen = true;
            } catch {
                // Ignore malformed messages; the next one will carry the full state.
            }
        };
    }

    onMount(() => {
        code = sessionStorage.getItem("eventCode") || "";
        if (!code) {
            missing = true;
            return;
        }

        try {
            const saved = JSON.parse(sessionStorage.getItem("eventPacket"));
            cityName = saved?.cityName || "";
            demos = !!saved?.demos;
            parsePacket(saved?.data, { quiet: true });
            seen = !!saved;
        } catch {
            // No cached packet; the stream will fill everything in.
        }

        connect();
        const clock = setInterval(() => (now = new Date()), 30000);

        return () => {
            source?.close();
            clearInterval(clock);
            clearTimeout(changedTimer);
        };
    });

    function leave() {
        sessionStorage.removeItem("eventCode");
        sessionStorage.removeItem("eventPacket");
        goto(resolve("/"));
    }

    const STATUS = {
        connecting: "Connecting",
        live: "Live",
        reconnecting: "Reconnecting",
        offline: "Offline"
    };
</script>

<svelte:head>
    <title>{eventName}{cityName ? ` ${cityName}` : ""} · Jumbotron</title>
</svelte:head>

<Backdrop trees={false} scrim={0.35} />

<div class="page">
    <header>
        <div class="topbar">
            <button class="btn btn-quiet back" onclick={leave}>
                <span class="icon" translate="no" aria-hidden="true">arrow_back</span>
                Leave
            </button>
            <Wordmark onArt size="s" />
            {#if !missing}
                <span class="status {connection}" role="status">
                    <span class="dot" aria-hidden="true"></span>{STATUS[connection]}
                </span>
            {:else}
                <span></span>
            {/if}
        </div>
        <h1>{eventName}{cityName ? ` ${cityName}` : ""}</h1>
    </header>

    <main class="sheet">
        {#if missing}
            <div class="notice">
                <p class="notice-title">You're not in an event yet</p>
                <p>Enter the 4-digit code shown at your event to see announcements and links.</p>
                <a class="btn btn-primary" href={resolve("/")}>Enter a code</a>
            </div>
        {:else}
            {#if connection === "offline"}
                <div class="offline" role="alert">
                    <span class="icon" translate="no" aria-hidden="true">cloud_off</span>
                    <p>Lost connection. What you see may be out of date.</p>
                    <button class="btn btn-small btn-primary" onclick={connect}>Reconnect</button>
                </div>
            {/if}

            {#if demos}
                <ShareScreen {code} bind:presenting />
            {/if}

            <DemoMirror {code} mirror={presenting ? null : mirror} />

            <AttendeeFeed
                data={liveshareData}
                {changed}
                {now}
                live
                emptyText={cityName ? "" : "Your organizers haven't started this event yet. This page updates on its own."}
            />
        {/if}
    </main>
</div>

<style>
    .page { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr; }

    header { padding: 16px 16px 28px; color: var(--on-art); text-align: center; }
    .topbar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        max-width: 640px;
        margin: 0 auto;
    }
    .back { --btn-ink: var(--on-art); justify-self: start; padding-left: 4px; }
    .back:hover { --btn-bg: oklch(1 0 0 / 0.12); }
    h1 {
        margin-top: 24px;
        font-family: var(--font-display);
        font-weight: 400;
        font-size: clamp(2.2rem, 9vw, 3.4rem);
        text-shadow: 0 2px 18px rgb(20 24 32 / 0.45);
        text-wrap: balance;
    }

    .status {
        justify-self: end;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        background: rgb(20 24 32 / 0.55);
        font-size: 0.85rem;
        font-weight: 700;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); }
    .status.live .dot { background: oklch(0.78 0.17 150); animation: breathe 2.4s ease-in-out infinite; }
    .status.reconnecting .dot, .status.connecting .dot { background: var(--accent); }
    .status.offline .dot { background: oklch(0.7 0.18 27); }
    @keyframes breathe { 50% { opacity: 0.45; } }

    /* Cards sit straight on the art; no sheet behind them */
    .sheet {
        width: 100%;
        max-width: 640px;
        margin: 0 auto;
        padding: 0 16px 56px;
    }

    .offline {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        padding: 10px 14px;
        border-radius: var(--radius-m);
        background: var(--surface);
    }
    .offline p { flex: 1; }
    .offline .icon { color: var(--danger); }

    .notice { display: grid; justify-items: center; gap: 10px; padding: 36px 20px; text-align: center; border-radius: var(--radius-l); background: var(--surface); }
    .notice-title { font-family: var(--font-display); font-size: 1.5rem; }
    .notice p { color: var(--ink-2); max-width: 40ch; }
    .notice .btn { margin-top: 8px; }

    @media (max-width: 420px) {
        .topbar :global(.wordmark) { font-size: 1.1rem; }
    }
</style>
