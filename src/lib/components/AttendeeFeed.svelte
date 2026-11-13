<script>
    // What attendees see. Used by the attendee portal and by the live preview in the console.
    // Each kind of content keeps its own leaf color everywhere, so it is recognisable at a glance.
    import { resolve } from "$app/paths";
    import { eventTheme } from "$lib/event.js";
    import { relativeToNow, parseClock, toAt } from "$lib/time.js";
    import { safeHref } from "$lib/links.js";
    import { announcementsOf, stampOf } from "$lib/announcements.js";

    // `live` makes screen readers read new and edited items out as they arrive (attendee page
    // only; the console preview would talk over the organizer's own edits).
    let { data, changed = [], now = new Date(), compact = false, emptyText = "", live = false } = $props();

    let announcements = $derived(announcementsOf(data));
    // Announcement times follow the clock format the organizers picked for Up next.
    let hour12 = $derived(typeof data.event?.hour12 === "boolean" ? data.event.hour12 : undefined);

    // Links from the packet are untrusted: anything that isn't plain http(s) is dropped.
    let fileHref = $derived(data.file ? safeHref(data.file) : null);
    let youtubeHref = $derived(data.youtube ? safeHref(typeof data.youtube === "object" ? data.youtube.url : data.youtube) : null);
    let websiteHref = $derived(data.website ? safeHref(data.website) : null);

    const eventAt = (ev) => ev.at || toAt(parseClock(ev.time));
    const host = (url) => {
        try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
    };

    let links = $derived(
        [
            fileHref && { key: "file", href: fileHref, icon: "description", color: "var(--c-file)", title: "Slides and documents", sub: "Read at your own pace" },
            youtubeHref && { key: "youtube", href: youtubeHref, icon: "smart_display", color: "var(--c-youtube)", title: "Watch the video", sub: "Opens on YouTube" },
            websiteHref && { key: "website", href: websiteHref, icon: "language", color: "var(--c-website)", title: "Open link", sub: host(websiteHref) }
        ].filter(Boolean)
    );

    let isEmpty = $derived(announcements.length === 0 && !data.event && links.length === 0);
</script>

<div class="feed" class:compact aria-live={live ? "polite" : undefined}>
    {#if isEmpty}
        <div class="empty">
            <img src={resolve(eventTheme.mascot)} alt="" />
            <p class="empty-title">Nothing on screen yet</p>
            <p class="empty-body">{emptyText || "Your organizers will post announcements and links here. This page updates on its own."}</p>
        </div>
    {/if}

    {#if announcements.length}
        <ul class="announcements" aria-label="Announcements">
            {#each announcements as a, i (a.id)}
                {@const stamp = stampOf(a, hour12)}
                {@const fresh = i === 0 && changed.includes("announcements")}
                <li class="block" class:earlier={i > 0} style:--c="var(--c-announcement)" class:changed={fresh} aria-atomic="true">
                    <p class="kind"><span class="icon" translate="no" aria-hidden="true">campaign</span>{i === 0 ? "Announcement" : "Earlier"}
                        {#if fresh}<span class="new">{a.updatedAt ? "Updated" : "New"}</span>{/if}</p>
                    {#if a.title}<h2>{a.title}</h2>{/if}
                    {#if a.message}<p class="body">{a.message}</p>{/if}
                    {#if stamp}<p class="stamp">{stamp.verb} at <time datetime={stamp.iso}>{stamp.text}</time></p>{/if}
                </li>
            {/each}
        </ul>
    {/if}

    {#if data.event}
        {@const rel = relativeToNow(eventAt(data.event), now)}
        <section class="block" style:--c="var(--c-event)" class:changed={changed.includes("event")} aria-label="Up next" aria-atomic="true">
            <p class="kind"><span class="icon" translate="no" aria-hidden="true">schedule</span>Up next
                {#if changed.includes("event")}<span class="new">New</span>{/if}</p>
            <h2>{data.event.title}</h2>
            <p class="when"><span class="time">{data.event.time}</span>{#if rel}<span class="rel">{rel}</span>{/if}</p>
        </section>
    {/if}

    {#if links.length}
        <ul class="links" aria-label="Links">
            {#each links as link (link.key)}
                <li>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" class:changed={changed.includes(link.key)} style:--c={link.color}>
                        <span class="swatch icon" translate="no" aria-hidden="true">{link.icon}</span>
                        <span class="link-text">
                            <span class="link-title">{link.title}</span>
                            <span class="link-sub">{link.sub}</span>
                        </span>
                        <span class="icon go" translate="no" aria-hidden="true">open_in_new</span>
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .feed { display: grid; gap: 12px; }

    /* Announcement and Up next: solid blocks of their leaf color */
    .block {
        padding: 20px 22px 22px;
        border-radius: var(--radius-l);
        background: var(--c);
        color: var(--on-color);
    }
    .kind {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 0.9rem;
        font-weight: 700;
    }
    .kind .icon { font-size: 1.15rem; }
    .new {
        margin-left: auto;
        padding: 2px 10px;
        border-radius: var(--radius-pill);
        background: var(--on-color);
        color: var(--c);
        font-size: 0.75rem;
    }
    h2 {
        font-size: 1.65rem;
        font-weight: 800;
        line-height: 1.12;
        letter-spacing: -0.015em;
        text-wrap: balance;
    }
    .body { margin-top: 8px; font-size: 1.08rem; max-width: 60ch; white-space: pre-line; }
    .stamp { margin-top: 10px; font-size: 0.86rem; font-weight: 700; opacity: 0.85; }

    .announcements { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    /* Older announcements stay readable but step back behind the newest */
    .earlier { padding: 14px 18px 16px; }
    .earlier h2 { font-size: 1.2rem; }
    .earlier .body { font-size: 0.98rem; margin-top: 4px; }
    .earlier .kind { opacity: 0.85; margin-bottom: 4px; }

    .when { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .time { font: 700 1.5rem/1 var(--font-mono); letter-spacing: -0.02em; }
    .rel {
        padding: 4px 12px;
        border-radius: var(--radius-pill);
        background: rgb(255 255 255 / 0.22);
        color: var(--on-color);
        font-weight: 700;
        font-size: 0.9rem;
    }

    /* Links: dark rows with a leaf-colored swatch */
    .links { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .links a {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px 12px 12px;
        border-radius: var(--radius-m);
        background: var(--surface);
        color: var(--ink);
        text-decoration: none;
        transition: background-color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
    }
    .links a:hover { background: var(--surface-raised); }
    .links a:active { transform: scale(0.99); }
    .swatch {
        flex: none;
        width: 46px;
        height: 46px;
        display: grid;
        place-items: center;
        border-radius: 13px;
        background: var(--c);
        color: var(--on-color);
        font-size: 1.5rem;
    }
    .link-text { flex: 1; display: grid; gap: 2px; min-width: 0; }
    .link-title { font-weight: 800; font-size: 1.05rem; }
    .link-sub { color: var(--ink-3); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .go { color: var(--ink-3); }

    .changed { animation: arrive 1.8s var(--ease-out); }
    @keyframes arrive {
        0% { box-shadow: 0 0 0 4px var(--on-art); transform: translateY(-4px); }
        100% { box-shadow: 0 0 0 0 transparent; transform: none; }
    }

    .empty {
        text-align: center;
        padding: 32px 20px 28px;
        border-radius: var(--radius-l);
        background: var(--surface);
    }
    .empty img { height: 76px; margin-bottom: 10px; }
    .empty-title { font-family: var(--font-display); font-size: 1.5rem; }
    .empty-body { margin: 6px auto 0; color: var(--ink-2); max-width: 36ch; }

    .compact { gap: 8px; }
    .compact .block { padding: 14px 16px 16px; border-radius: var(--radius-m); }
    .compact .kind { font-size: 0.78rem; margin-bottom: 4px; }
    .compact h2 { font-size: 1.2rem; }
    .compact .body { font-size: 0.92rem; margin-top: 4px; }
    .compact .stamp { font-size: 0.75rem; margin-top: 6px; }
    .compact .earlier h2 { font-size: 1rem; }
    .compact .time { font-size: 1.1rem; }
    .compact .rel { font-size: 0.78rem; padding: 2px 8px; }
    .compact .when { margin-top: 8px; }
    .compact .links a { padding: 8px 12px 8px 8px; gap: 10px; }
    .compact .swatch { width: 34px; height: 34px; font-size: 1.2rem; border-radius: 10px; }
    .compact .link-title { font-size: 0.92rem; }
    .compact .link-sub { font-size: 0.8rem; }
    .compact .empty { padding: 20px 10px; }
    .compact .empty img { height: 52px; }
    .compact .empty-title { font-size: 1.15rem; }
    .compact .empty-body { font-size: 0.85rem; }
</style>
