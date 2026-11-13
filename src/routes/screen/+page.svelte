<script>
    // The big screen: the tab an organizer drags onto the projector. Shows the announcement and
    // what's up next (when the board is on); during demo time it shows the code to type, then the
    // presenter's screen.
    // Opened from the console, it signs in with the organizer credentials saved on this device.
    // A venue computer nobody signs in on is paired instead: the console shows a 6-digit code,
    // typed here once, and the screen key it unlocks is kept in this browser.
    import { resolve } from "$app/paths";
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { eventName } from "$lib/event";
    import { internal } from "$lib/liveshare.svelte.js";
    import { API, request } from "$lib/org.svelte.js";
    import { relativeToNow, parseClock, toAt } from "$lib/time.js";
    import { announcementsOf, stampOf } from "$lib/announcements.js";

    const HARPA_URL = import.meta.env.VITE_HARPA_URL || "https://harpa.hackclub.com/?jumbotron=true";
    import Backdrop from "$lib/components/Backdrop.svelte";
    import Wordmark from "$lib/components/Wordmark.svelte";

    const PAIR_KEY = "screenPair";

    let status = $state("loading"); // loading | signedout | ready | replaced
    let paired = $state(false);     // signed in with a pairing code rather than organizer credentials
    let unpairedNote = $state("");
    let pairCode = $state("");
    let pairError = $state("");
    let pairing = $state(false);
    let connected = $state(false);
    let cityName = $state("");
    let content = $state({ announcement: null, event: null, hour12: undefined });
    let demo = $state({ enabled: false, board: true, screenCode: null, presenter: null });
    let playing = $state(false);   // the presenter's video has frames
    let muted = $state(false);     // the browser refused sound until someone clicks
    let isFullscreen = $state(false);
    let slow = $state(false);      // presenter picked a window but no video after a while
    let idle = $state(false);      // no mouse movement lately: hide the cursor and the buttons
    let now = $state(new Date());
    let video = $state();
    let harpa = $state(false);     // the organizer turned harpa on for this event

    let iceServers = [];
    let feed = null;       // public content, the same stream attendees get
    let control = null;    // demo state and the presenter's half of the handshake
    let retry = null;
    let pc = null;
    let pcFor = null;      // presenter id the current connection belongs to
    let queue = Promise.resolve();
    let wakeLock = null;
    let idleTimer = null;

    let attendeeCode = $state(null);   // the event's code, from the feed (an organizer's own code leads there too)
    let joinLink = $derived(`jumbotron.hackclub.com/?code=${attendeeCode ?? internal.code ?? ""}`);
    let presenter = $derived(demo.enabled ? demo.presenter : null);
    let board = $derived(demo.board !== false);
    // Harpa plays its own music, which would talk over a live presenter: it's unloaded while
    // someone presents and reloads afterwards (harpa picks up where it left off).
    let showHarpa = $derived(harpa && !presenter?.live);
    const eventAt = (ev) => ev.at || toAt(parseClock(ev.time));

    function openFeed() {
        feed?.close();
        feed = new EventSource(`${API}/getSession?code=${encodeURIComponent(internal.code)}`);
        feed.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.cityName) cityName = payload.cityName;
                if (payload.code) attendeeCode = payload.code;
                const data = typeof payload.data === "string" ? JSON.parse(payload.data) : payload.data;
                // The big screen shows only the newest announcement; attendees get the rest.
                content = {
                    announcement: announcementsOf(data)[0] || null,
                    event: data?.event || null,
                    hour12: typeof data?.event?.hour12 === "boolean" ? data.event.hour12 : undefined
                };
            } catch {
                // The next message carries the full state again.
            }
        };
    }

    // Same ticket dance as the console: credentials go in a POST body, never in a stream URL.
    async function openControl() {
        clearTimeout(retry);
        control?.close();
        control = null;
        connected = false;
        let ticket;
        try {
            const { res, data } = await request("/streamTicket");
            if (res.status === 401) {
                signOutScreen();
                return;
            }
            if (!res.ok || !data.ticket) throw new Error();
            ticket = data.ticket;
        } catch {
            retry = setTimeout(openControl, 5000);
            return;
        }

        const es = (control = new EventSource(`${API}/screenStream?ticket=${encodeURIComponent(ticket)}`));
        es.onopen = () => {
            if (es === control) connected = true;
        };
        es.onmessage = (event) => {
            if (es !== control) return;
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }
            if (msg.type === "hello") iceServers = msg.iceServers || [];
            else if (msg.type === "demo") applyDemo(msg.demo);
            else if (msg.type === "harpa") harpa = !!msg.harpa?.enabled;
            else if (msg.type === "signal") queue = queue.then(() => onSignal(msg)).catch(() => {});
            else if (msg.type === "viewerSignal") viewerQueue = viewerQueue.then(() => onViewerSignal(msg)).catch(() => {});
            else if (msg.type === "viewerLeave") closeViewer(msg.viewer);
            else if (msg.type === "replaced") {
                // Another tab is the big screen now. Don't fight it for the slot.
                es.close();
                control = null;
                closePeer();
                status = "replaced";
            } else if (msg.type === "moved") {
                // This organizer joined or left an event: reconnect to whichever screen is ours now.
                es.close();
                control = null;
                closePeer();
                retry = setTimeout(openControl, 500);
            } else if (msg.type === "revoked") {
                es.close();
                control = null;
                signOutScreen();
            }
        };
        es.onerror = () => {
            if (es !== control) return;
            // A used ticket can't reconnect; get a fresh one. A live video keeps playing meanwhile.
            es.close();
            connected = false;
            retry = setTimeout(openControl, 3000);
        };
    }

    function applyDemo(next) {
        demo = next;
        if (!next.enabled || !next.presenter || next.presenter.id !== pcFor) closePeer();
    }

    function closePeer() {
        closeViewers();
        pc?.close();
        pc = null;
        pcFor = null;
        playing = false;
        muted = false;
        if (video) video.srcObject = null;
    }

    async function onSignal({ from, signal }) {
        if (!demo.presenter || demo.presenter.id !== from) return;

        if (signal.description?.type === "offer") {
            closePeer();
            const peer = (pc = new RTCPeerConnection({ iceServers }));
            pcFor = from;
            const reply = (body) => request("/demoSignal", { to: from, signal: body }).catch(() => {});
            peer.onicecandidate = (e) => {
                if (e.candidate && peer === pc) reply({ candidate: e.candidate });
            };
            peer.ontrack = (e) => {
                if (peer === pc) show(e.streams[0]);
            };
            await peer.setRemoteDescription(signal.description);
            await peer.setLocalDescription(await peer.createAnswer());
            await reply({ description: peer.localDescription });
        } else if (signal.candidate && pc && pcFor === from) {
            await pc.addIceCandidate(signal.candidate);
        }
    }

    async function show(stream) {
        if (!video || video.srcObject === stream) return;
        video.srcObject = stream;
        // Watchers already connected keep their connection and just get the new picture.
        for (const peer of viewerPcs.values()) {
            for (const sender of peer.getSenders()) {
                const track = sender.track?.kind === "video" ? stream.getVideoTracks()[0] : null;
                if (track) sender.replaceTrack(track).catch(() => {});
            }
        }
        video.muted = false;
        try {
            await video.play();
        } catch {
            // Autoplay with sound needs a click on this tab first; silent video never does.
            video.muted = true;
            muted = true;
            video.play().catch(() => {});
        }
    }

    function unmute() {
        if (!video) return;
        video.muted = false;
        muted = false;
    }

    // Live mirror: attendees who open the viewer get the presenter's video straight from this
    // tab over WebRTC (one connection each, capped on the server). They send the offer; this
    // tab answers with the video it is already playing.
    const VIEWER_KBPS = 900;
    const VIEWER_MAX_WIDTH = 1280;
    let viewerPcs = new Map();     // viewer id -> RTCPeerConnection
    let viewerQueue = Promise.resolve();

    function closeViewer(id) {
        viewerPcs.get(id)?.close();
        viewerPcs.delete(id);
    }

    function closeViewers() {
        for (const id of [...viewerPcs.keys()]) closeViewer(id);
    }

    async function onViewerSignal({ viewer, signal }) {
        const reply = (body) => request("/demoSignal", { viewer, signal: body }).catch(() => {});
        if (signal.description?.type === "offer") {
            const stream = video?.srcObject;
            if (!stream || !stream.getVideoTracks().length) return;   // nothing to send yet; they fall back to snapshots
            closeViewer(viewer);
            const peer = new RTCPeerConnection({ iceServers });
            viewerPcs.set(viewer, peer);
            peer.onicecandidate = (e) => {
                if (e.candidate && viewerPcs.get(viewer) === peer) reply({ candidate: e.candidate });
            };
            peer.onconnectionstatechange = () => {
                if (["failed", "closed"].includes(peer.connectionState) && viewerPcs.get(viewer) === peer) closeViewer(viewer);
            };
            await peer.setRemoteDescription(signal.description);
            for (const track of stream.getVideoTracks()) peer.addTrack(track, stream);   // no sound: the room already hears it
            await peer.setLocalDescription(await peer.createAnswer());
            await reply({ description: peer.localDescription });
            // A shared screen can be huge. Cap size and bitrate so one laptop can feed many phones.
            for (const sender of peer.getSenders()) {
                if (sender.track?.kind !== "video") continue;
                try {
                    const params = sender.getParameters();
                    const width = sender.track.getSettings().width || VIEWER_MAX_WIDTH;
                    params.encodings = params.encodings?.length ? params.encodings : [{}];
                    params.encodings[0].maxBitrate = VIEWER_KBPS * 1000;
                    params.encodings[0].maxFramerate = 30;
                    params.encodings[0].scaleResolutionDownBy = Math.max(1, width / VIEWER_MAX_WIDTH);
                    await sender.setParameters(params);
                } catch {
                    // Older browsers ignore this; the stream still plays.
                }
            }
        } else if (signal.candidate && viewerPcs.has(viewer)) {
            await viewerPcs.get(viewer).addIceCandidate(signal.candidate);
        }
    }

    // Mirror: when organizers turn it on, attendees also see the presenter's screen. The video
    // only reaches this tab, so this tab posts a JPEG snapshot of it twice a second, skipping
    // frames where nothing changed (a still slide costs nothing).
    const MIRROR_MS = 250;
    const MIRROR_WIDTH = 960;
    const MIRROR_IDLE_MS = 10000;   // resend an unchanged picture this often, just in case
    let mirroring = $derived(!!(demo.enabled && demo.mirror && presenter?.live && playing));

    $effect(() => {
        if (!mirroring) return;
        const full = document.createElement("canvas");
        const thumb = document.createElement("canvas");
        thumb.width = 160;
        thumb.height = 90;
        const thumbCtx = thumb.getContext("2d", { willReadFrequently: true });
        let last = null;
        let lastSent = 0;
        let sending = false;

        function changed() {
            thumbCtx.drawImage(video, 0, 0, thumb.width, thumb.height);
            const px = thumbCtx.getImageData(0, 0, thumb.width, thumb.height).data;
            let moved = !last;
            for (let i = 0; !moved && i < px.length; i += 4) {
                moved = Math.abs(px[i] - last[i]) > 10 || Math.abs(px[i + 1] - last[i + 1]) > 10 || Math.abs(px[i + 2] - last[i + 2]) > 10;
            }
            last = px;
            return moved;
        }

        async function tick() {
            if (sending || !video?.videoWidth) return;
            if (!changed() && Date.now() - lastSent < MIRROR_IDLE_MS) return;
            const w = Math.min(MIRROR_WIDTH, video.videoWidth);
            full.width = w;
            full.height = Math.round((video.videoHeight * w) / video.videoWidth);
            full.getContext("2d").drawImage(video, 0, 0, full.width, full.height);
            let frame = full.toDataURL("image/jpeg", 0.5);
            if (frame.length > 260000) frame = full.toDataURL("image/jpeg", 0.35);
            sending = true;
            try {
                await request("/demoFrame", { frame });
            } catch {
                // The next tick tries again.
            } finally {
                sending = false;
                lastSent = Date.now();
            }
        }

        const timer = setInterval(tick, MIRROR_MS);
        return () => clearInterval(timer);
    });

    // A presenter stuck connecting usually means the wifi blocks device-to-device traffic.
    $effect(() => {
        slow = false;
        if (!presenter?.live || playing) return;
        const timer = setTimeout(() => (slow = true), 20000);
        return () => clearTimeout(timer);
    });

    function wake() {
        idle = false;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => (idle = true), 2500);
    }

    function goFullscreen() {
        document.documentElement.requestFullscreen?.().catch(() => {});
    }

    async function stayAwake() {
        try {
            wakeLock = await navigator.wakeLock?.request("screen");
        } catch {
            // Not supported or not allowed; the projector may dim, nothing else breaks.
        }
    }

    function start() {
        status = "ready";
        openFeed();
        openControl();
    }

    // Credentials stopped working. A paired screen forgets its key and asks for a new code.
    function signOutScreen() {
        feed?.close();
        feed = null;
        closePeer();
        if (paired) {
            try { localStorage.removeItem(PAIR_KEY); } catch {}
            internal.code = null;
            internal.screenKey = null;
            paired = false;
            unpairedNote = "This screen was signed out from the organizer console. Pair it again to continue.";
        }
        status = "signedout";
    }

    async function pair(event) {
        event.preventDefault();
        const typed = pairCode.replace(/\D/g, "");
        if (typed.length !== 6) {
            pairError = "Type all 6 digits.";
            return;
        }
        pairing = true;
        pairError = "";
        try {
            const res = await fetch(`${API}/screenPair`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pairCode: typed }),
                signal: AbortSignal.timeout(15000)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.code || !data.screenKey) {
                pairError = data.error || "That code didn't work. Try again.";
                return;
            }
            try { localStorage.setItem(PAIR_KEY, JSON.stringify({ code: data.code, screenKey: data.screenKey })); } catch {}
            internal.code = data.code;
            internal.screenKey = data.screenKey;
            internal.password = null;
            paired = true;
            unpairedNote = "";
            pairCode = "";
            start();
        } catch {
            pairError = "Can't reach Jumbotron right now. Check the connection and try again.";
        } finally {
            pairing = false;
        }
    }

    onMount(() => {
        let creds, pairedCreds;
        try { creds = JSON.parse(localStorage.getItem("creds")); } catch { creds = null; }
        try { pairedCreds = JSON.parse(localStorage.getItem(PAIR_KEY)); } catch { pairedCreds = null; }
        // The name comes from the server (an organizer's console shows the owner's): no stale local copy.
        if (Array.isArray(creds)) {
            [internal.code, internal.slack, internal.name, internal.password] = creds;
            start();
        } else if (pairedCreds?.code && pairedCreds?.screenKey) {
            internal.code = pairedCreds.code;
            internal.screenKey = pairedCreds.screenKey;
            internal.password = null;
            paired = true;
            start();
        } else {
            status = "signedout";
        }

        stayAwake();
        wake();

        const clock = setInterval(() => (now = new Date()), 30000);
        const onFullscreen = () => (isFullscreen = !!document.fullscreenElement);
        // The wake lock is dropped whenever the tab is hidden.
        const onVisible = () => document.visibilityState === "visible" && stayAwake();
        document.addEventListener("fullscreenchange", onFullscreen);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(clock);
            clearTimeout(retry);
            clearTimeout(idleTimer);
            document.removeEventListener("fullscreenchange", onFullscreen);
            document.removeEventListener("visibilitychange", onVisible);
            feed?.close();
            control?.close();
            closePeer();
            wakeLock?.release?.().catch(() => {});
        };
    });
</script>

<svelte:head>
    <title>Big screen · {eventName}{cityName ? ` ${cityName}` : ""}</title>
</svelte:head>

<svelte:window onpointermove={wake} onkeydown={wake} />

{#if showHarpa}
    <!-- hackclub/harpa, embedded as-is so its updates show up here. Its settings (gear, top
         right) are stored in this browser, so set it up on the projector laptop. -->
    <iframe class="harpa" src={HARPA_URL} title="Harpa lo-fi music" allow="autoplay; encrypted-media; fullscreen" transition:fade={{ duration: 300 }}></iframe>
{:else}
    <Backdrop scrim={0.4} />
{/if}

{#if status === "signedout" || status === "replaced"}
    <main class="message">
        <Wordmark onArt />
        {#if status === "replaced"}
            <h1>The big screen is open in another tab</h1>
            <p>Only one tab can be the big screen. Close the other one, then reload this page.</p>
            <button class="btn btn-on-art" onclick={() => location.reload()}>Use this tab</button>
        {:else}
            <h1>Pair this screen</h1>
            {#if unpairedNote}<p class="note" role="status">{unpairedNote}</p>{/if}
            <p>In the organizer console, open <strong>Big screen</strong>, choose <strong>Pair a computer</strong>, and type the 6-digit code here. Nobody has to sign in on this computer.</p>
            <form class="pair" onsubmit={pair}>
                <label class="sr-only" for="pair-code">Pairing code</label>
                <input
                    id="pair-code"
                    class="input mono"
                    bind:value={pairCode}
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="7"
                    placeholder="000000"
                    aria-invalid={!!pairError}
                    aria-describedby={pairError ? "pair-error" : undefined}
                />
                <button class="btn btn-on-art" disabled={pairing}>{pairing ? "Pairing" : "Pair screen"}</button>
            </form>
            {#if pairError}<p class="pair-error" id="pair-error" role="alert">{pairError}</p>{/if}
            <p class="alt">Organizer on this computer? <a href={resolve("/")}>Sign in instead</a></p>
        {/if}
    </main>
{:else if status === "ready"}
    <div class="screen" class:idle class:harpa>
        <header>
            <Wordmark onArt />
            <span class="join">Follow along at <strong class="mono" translate="no">{joinLink}</strong></span>
        </header>

        <main class="stage">
            {#if !harpa}
                <h1>{eventName}{cityName ? ` ${cityName}` : ""}</h1>
            {/if}

            {#if board && content.announcement}
                {@const stamp = stampOf(content.announcement, content.hour12)}
                <section class="card" in:fade={{ duration: 200 }}>
                    <p class="kind"><span class="icon" translate="no" aria-hidden="true">campaign</span>Announcement
                        {#if stamp}<span class="stamp">· {stamp.verb} <time datetime={stamp.iso}>{stamp.text}</time></span>{/if}</p>
                    {#if content.announcement.title}<h2>{content.announcement.title}</h2>{/if}
                    {#if content.announcement.message}<p class="body">{content.announcement.message}</p>{/if}
                </section>
            {/if}

            {#if board && content.event}
                {@const rel = relativeToNow(eventAt(content.event), now)}
                <section class="card" in:fade={{ duration: 200 }}>
                    <p class="kind"><span class="icon" translate="no" aria-hidden="true">schedule</span>Up next</p>
                    <h2>{content.event.title}</h2>
                    <p class="body"><span>{content.event.time}</span>{#if rel}<span class="rel"> · {rel}</span>{/if}</p>
                </section>
            {/if}
        </main>

        {#if demo.enabled && !presenter}
            <aside class="airplay" in:fade={{ duration: 200 }}>
                <span class="icon" translate="no" aria-hidden="true">cast</span>
                <div class="how">
                    <p class="how-title">Demo time: share your screen</p>
                    <p>Open <strong class="mono" translate="no">{joinLink}</strong> on your laptop and tap Share my screen</p>
                </div>
                <div class="code-box">
                    <span>Screen code</span>
                    <strong class="mono" translate="no">{demo.screenCode ?? "····"}</strong>
                </div>
            </aside>
        {/if}

        {#if !isFullscreen && !idle}
            <button class="btn btn-on-art fullscreen" transition:fade={{ duration: 150 }} onclick={goFullscreen}>
                <span class="icon" translate="no" aria-hidden="true">fullscreen</span>Full screen
            </button>
        {/if}
        {#if !connected}
            <p class="offline" role="status">Reconnecting</p>
        {/if}
    </div>

    <!-- Always mounted so the stream has somewhere to land the moment it arrives. -->
    <div class="theatre" class:on={!!presenter} class:idle>
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={video} autoplay playsinline class:on={playing} onplaying={() => (playing = true)}></video>
        {#if presenter}
            {#if !playing}
                <p class="waiting" role="status">
                    <span class="spinner" aria-hidden="true"></span>
                    {presenter.name} is {presenter.live ? "connecting" : "getting ready"}
                </p>
                {#if slow}
                    <p class="slow">Still connecting. This network may block screen sharing between devices.</p>
                {/if}
            {/if}
            <p class="nameplate"><span class="icon" translate="no" aria-hidden="true">present_to_all</span>{presenter.name}</p>
            {#if muted}
                <button class="btn btn-on-art unmute" onclick={unmute}>Click for sound</button>
            {/if}
        {/if}
    </div>
{/if}

<style>
    .message {
        min-height: 100dvh;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 14px;
        padding: 24px;
        color: var(--on-art);
        text-align: center;
    }
    .message h1 { font-family: var(--font-display); font-weight: 400; font-size: clamp(1.8rem, 4vw, 2.8rem); }
    .message .btn { margin-top: 10px; text-decoration: none; }
    .message p { max-width: 46ch; font-size: clamp(1rem, 1.6vw, 1.3rem); }
    .message .note { padding: 10px 16px; border-radius: var(--radius-m); background: rgb(20 24 32 / 0.6); font-weight: 700; }
    .pair { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 8px; }
    .pair .input { width: 9ch; padding: 12px 14px; font-size: 2rem; font-weight: 700; letter-spacing: 0.18em; text-align: center; }
    .pair .btn { margin-top: 0; }
    .pair-error { padding: 8px 14px; border-radius: var(--radius-m); background: var(--danger-wash); color: var(--danger); font-weight: 700; }
    .alt a { color: var(--on-art); font-weight: 700; }

    /* Sized in vw/vh throughout: this page is read from across a room, on any projector. */
    .screen {
        min-height: 100dvh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 3vh;
        padding: 4vh 5vw;
        color: var(--on-art);
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 2vw; }
    .join { padding: 0.5em 1em; border-radius: var(--radius-pill); background: rgb(20 24 32 / 0.55); font-size: clamp(1.1rem, 2vw, 2.4rem); }

    .stage { display: grid; align-content: center; justify-items: center; gap: 3vh; text-align: center; }
    h1 {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: clamp(3rem, 8vw, 11rem);
        line-height: 1;
        text-shadow: 0 2px 18px rgb(20 24 32 / 0.45);
        text-wrap: balance;
    }
    .card {
        width: min(100%, 82vw);
        display: grid;
        gap: 0.6vh;
        padding: 2.4vh 2.4vw;
        border-radius: var(--radius-l);
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-2);
        text-align: left;
    }
    /* Read from the back of the room: the headline is the biggest thing after the event name */
    .kind { display: flex; align-items: center; gap: 0.4em; color: var(--ink-2); font-size: clamp(1.1rem, 2vw, 2.6rem); font-weight: 700; }
    .stamp { color: var(--ink-3); font-weight: 700; }
    .card h2 { font-size: clamp(2.2rem, 5vw, 7rem); line-height: 1.05; text-wrap: balance; }
    .body { font-size: clamp(1.4rem, 3vw, 4rem); line-height: 1.25; color: var(--ink-2); white-space: pre-line; }
    /* Big type plus a long message would push the screen past the projector's edge; the full
       text is on attendees' devices. */
    .card h2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
    .card .body { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow: hidden; }
    .rel { color: var(--ink-3); }

    .airplay {
        justify-self: center;
        display: flex;
        align-items: center;
        gap: 2vw;
        padding: 2vh 2.4vw;
        border-radius: var(--radius-l);
        background: rgb(20 24 32 / 0.72);
        backdrop-filter: blur(14px);
        font-size: clamp(1.2rem, 2vw, 2.6rem);
    }
    .airplay > .icon { font-size: 2.6em; }
    .how { display: grid; gap: 0.2em; }
    .how-title { font-weight: 800; font-size: 1.25em; }
    .code-box { display: grid; justify-items: center; padding-left: 2vw; border-left: 1px solid rgb(255 255 255 / 0.3); font-weight: 700; }
    .code-box strong { font-size: 3em; line-height: 1; letter-spacing: 0.12em; }

    /* Harpa fills the screen behind everything. Clicks go through this page's overlays to it
       (its gear and play buttons), except on our own buttons and cards. Its gear and logos sit
       at the top, so the join link moves to the bottom right and the wordmark steps aside. */
    iframe.harpa { position: fixed; inset: 0; z-index: 0; width: 100%; height: 100%; border: 0; background: rgb(186, 96, 35); }
    .screen.harpa { position: relative; z-index: 1; pointer-events: none; grid-template-rows: 1fr auto auto; }
    .screen.harpa :is(button, a, .card, .airplay) { pointer-events: auto; }
    .screen.harpa header { grid-row: 3; justify-content: flex-end; }
    .screen.harpa header > :global(:first-child) { display: none; }
    .screen.harpa .stage { grid-row: 1; }

    .idle { cursor: none; }
    .fullscreen { position: fixed; right: 16px; top: 50%; transform: translateY(-50%); opacity: 0.8; }
    .fullscreen:hover { opacity: 1; }
    .offline { position: fixed; left: 16px; bottom: 16px; padding: 6px 12px; border-radius: var(--radius-pill); background: rgb(20 24 32 / 0.72); color: var(--on-art); font-weight: 700; font-size: 0.85rem; }

    .theatre { position: fixed; inset: 0; z-index: 2; display: none; place-items: center; background: #000; color: var(--on-art); }
    .theatre.on { display: grid; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; }
    video.on { opacity: 1; }
    .waiting { display: flex; align-items: center; gap: 0.6em; font-size: clamp(1.4rem, 2.6vw, 3rem); font-weight: 700; }
    .spinner { width: 1em; height: 1em; border: 0.14em solid rgb(255 255 255 / 0.3); border-top-color: var(--on-art); border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .slow { position: absolute; top: calc(50% + 3em); max-width: 40ch; text-align: center; color: rgb(255 255 255 / 0.75); font-size: clamp(1rem, 1.5vw, 1.8rem); }
    .nameplate {
        position: absolute;
        left: 2vw;
        bottom: 3vh;
        display: flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.4em 0.9em;
        border-radius: var(--radius-pill);
        background: rgb(20 24 32 / 0.72);
        font-size: clamp(1rem, 1.5vw, 1.8rem);
        font-weight: 700;
    }
    .unmute { position: absolute; right: 2vw; bottom: 3vh; }

    @media (prefers-reduced-motion: reduce) {
        .spinner { animation: none; }
    }
</style>
