<script>
    // Demo time on the attendee page: enter your name, type the code from the big screen,
    // wait in the queue until an organizer approves you, then pick a window and it plays on the
    // projector. The video goes straight from this laptop to the projector tab
    // (WebRTC); the server only checks the code and passes the handshake along.
    import { onDestroy } from "svelte";
    import { slide } from "svelte/transition";
    import { API } from "$lib/org.svelte.js";
    import { savedName, saveName, cleanName, deviceId, MAX_NAME } from "$lib/presenterName.js";

    // `presenting` tells the page this device is sharing (so it doesn't mirror itself back).
    let { code, presenting = $bindable(false) } = $props();

    // idle -> code -> queued -> pick -> connecting -> live. Leaving any step goes back to idle.
    let step = $state("idle");
    $effect(() => {
        presenting = step === "pick" || step === "connecting" || step === "live";
    });
    let name = $state(savedName()); // typed by the presenter; not verified
    let position = $state(0);       // place in the queue, 1 = next
    let screenCode = $state("");
    let busy = $state(false);
    let error = $state("");
    let notice = $state("");
    let slow = $state(false);   // connecting for a while: the network may be blocking it
    let preview = $state();

    let supported = $derived(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia);

    let token = null;
    let iceServers = [];
    let media = null;
    let feed = null;      // EventSource carrying the projector's half of the handshake
    let pc = null;
    let queue = Promise.resolve();

    const ENDED = {
        stopped: "An organizer stopped your screenshare.",
        demos_off: "Demo time is over.",
        replaced: "An organizer gave the big screen to someone else. Join the queue again if you still want to present.",
        removed: "An organizer took you out of the queue.",
        blocked: "An organizer removed you from demo time.",
        timeout: "That took a little too long. Join the queue again to try again.",
        lost: "Lost connection to the big screen.",
        closed: "Your screenshare ended."
    };

    function begin() {
        notice = "";
        step = "code";
    }

    async function send(path, body) {
        const response = await fetch(`${API}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, token, ...body }),
            keepalive: true
        });
        return { response, data: await response.json().catch(() => ({})) };
    }

    async function join(event) {
        event.preventDefault();
        if (busy) return;
        busy = true;
        error = "";
        try {
            const who = cleanName(name);
            if (!who) {
                error = "Type your name so organizers know who you are.";
                return;
            }
            saveName(who);
            const { response, data } = await send("/demoJoin", { token: undefined, screenCode, name: who, device: deviceId() });
            if (!response.ok || !data.token) {
                error = data.error || "Couldn't join. Try again.";
                return;
            }
            token = data.token;
            iceServers = data.iceServers || [];
            position = 0;
            step = "queued";
            listen();
        } catch {
            error = "Can't reach Jumbotron right now. Check your connection.";
        } finally {
            busy = false;
        }
    }

    // Runs straight from the click: browsers only open the screen picker on a user gesture.
    async function pick() {
        error = "";
        try {
            media = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
        } catch (e) {
            // Dismissing the picker isn't an error worth shouting about.
            if (e?.name !== "NotAllowedError") error = "Your browser couldn't share the screen.";
            return;
        }
        // The browser's own "Stop sharing" bar.
        media.getVideoTracks()[0].addEventListener("ended", () => stop());
        step = "connecting";
        // Tells the server we're ready; it answers on the feed with "ready" to start the handshake.
        const { response } = await send("/demoPicked").catch(() => ({}));
        if (!response?.ok) finish(ENDED.closed);
    }

    function listen() {
        feed = new EventSource(`${API}/demoStream?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
        feed.onmessage = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }
            if (msg.type === "ended") return finish(ENDED[msg.reason] || ENDED.closed);
            if (msg.type === "queued") {
                position = msg.position;
                return;
            }
            if (msg.type === "approved") {
                if (step === "queued") step = "pick";
                return;
            }
            // One at a time, in order: an ICE candidate can't be added until the answer is in.
            queue = queue.then(() => handle(msg)).catch(() => {});
        };
        feed.onerror = () => {
            // CLOSED means the server refused the reconnect: the share is over on its side.
            if (feed?.readyState === EventSource.CLOSED) finish(ENDED.lost);
        };
    }

    async function handle(msg) {
        if (msg.type === "ready") {
            const healthy = pc && ["new", "connecting", "connected"].includes(pc.connectionState);
            if (msg.restart || !healthy) await offer();
        } else if (msg.type === "signal" && pc) {
            if (msg.signal.description) await pc.setRemoteDescription(msg.signal.description);
            else if (msg.signal.candidate) await pc.addIceCandidate(msg.signal.candidate);
        }
    }

    async function offer() {
        pc?.close();
        const peer = (pc = new RTCPeerConnection({ iceServers }));
        for (const track of media.getTracks()) peer.addTrack(track, media);
        peer.onicecandidate = (e) => {
            if (e.candidate && peer === pc) send("/demoSignal", { signal: { candidate: e.candidate } }).catch(() => {});
        };
        peer.onconnectionstatechange = () => {
            if (peer !== pc) return;
            if (peer.connectionState === "connected") step = "live";
            else if (peer.connectionState === "failed") {
                step = "connecting";
                queue = queue.then(offer).catch(() => {});
            }
        };
        await peer.setLocalDescription(await peer.createOffer());
        await send("/demoSignal", { signal: { description: peer.localDescription } });
    }

    function teardown() {
        feed?.close();
        feed = null;
        pc?.close();
        pc = null;
        media?.getTracks().forEach((t) => t.stop());
        media = null;
        queue = Promise.resolve();
    }

    function finish(message = "") {
        teardown();
        token = null;
        screenCode = "";
        position = 0;
        notice = message;
        step = "idle";
    }

    function stop() {
        if (token) send("/demoLeave").catch(() => {});
        finish();
    }

    $effect(() => {
        if (preview && (step === "connecting" || step === "live")) preview.srcObject = media;
    });

    // Some venue wifi blocks devices from reaching each other. Keep trying, but say so.
    $effect(() => {
        slow = false;
        if (step !== "connecting") return;
        const timer = setTimeout(() => (slow = true), 20000);
        return () => clearTimeout(timer);
    });

    onDestroy(() => {
        if (token) send("/demoLeave").catch(() => {});
        teardown();
    });
</script>

<section class="share" class:live={step === "live"} aria-label="Demo time">
    <p class="kind"><span class="icon" translate="no" aria-hidden="true">present_to_all</span>Demo time</p>

    {#if !supported}
        <h2>Show your project on the big screen</h2>
        <p class="body">Screen sharing needs a laptop. Open this page there to present.</p>
    {:else if step === "idle"}
        <h2>Show your project on the big screen</h2>
        {#if notice}<p class="body" role="status">{notice}</p>{/if}
        <button class="btn btn-primary" onclick={begin}>
            <span class="icon" translate="no" aria-hidden="true">cast</span>Share my screen
        </button>
    {:else if step === "code"}
        <form onsubmit={join} transition:slide={{ duration: 200 }}>
            <label class="field">
                <span>Your name</span>
                <input class="input" bind:value={name} maxlength={MAX_NAME} autocomplete="name" placeholder="Ada Lovelace" required />
            </label>
            <label class="field">
                <span>Code on the big screen</span>
                <input
                    class="input mono digits"
                    bind:value={screenCode}
                    inputmode="numeric"
                    pattern="[0-9]{'{4}'}"
                    maxlength="4"
                    autocomplete="off"
                    placeholder="0000"
                    required
                />
            </label>
            {#if error}<p class="error-text" role="alert">{error}</p>{/if}
            <div class="actions">
                <button class="btn btn-primary" disabled={busy}>{busy ? "Checking" : "Continue"}</button>
                <button type="button" class="btn btn-quiet" onclick={() => finish()}>Cancel</button>
            </div>
        </form>
    {:else if step === "queued"}
        <h2 role="status">{position === 1 ? "You're next" : position > 1 ? `You're #${position} in line` : "Joining the queue"}</h2>
        <p class="body">An organizer will let you on the big screen. Keep this page open; you'll pick what to share when it's your turn.</p>
        <div class="actions">
            <button class="btn btn-quiet" onclick={stop}>Leave the queue</button>
        </div>
    {:else if step === "pick"}
        <h2>You're up, {cleanName(name) || "you"}</h2>
        <p class="body">Pick the window or tab with your project. It goes on the big screen right away.</p>
        {#if error}<p class="error-text" role="alert">{error}</p>{/if}
        <div class="actions">
            <button class="btn btn-primary" onclick={pick}>
                <span class="icon" translate="no" aria-hidden="true">present_to_all</span>Choose what to share
            </button>
            <button class="btn btn-quiet" onclick={stop}>Cancel</button>
        </div>
    {:else}
        <h2 role="status">{step === "live" ? "You're on the big screen" : "Connecting to the big screen"}</h2>
        {#if slow}
            <p class="body" role="status">This is taking a while. The wifi here may block screen sharing between devices. Ask an organizer, or try another network.</p>
        {/if}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={preview} autoplay muted playsinline></video>
        <div class="actions">
            <button class="btn btn-destructive" onclick={stop}>
                <span class="icon" translate="no" aria-hidden="true">stop_screen_share</span>Stop sharing
            </button>
        </div>
    {/if}
</section>

<style>
    .share {
        --c: var(--orange);
        display: grid;
        gap: 12px;
        margin-bottom: 12px;
        padding: 18px 20px 20px;
        border-radius: var(--radius-l);
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-1);
    }
    .kind .icon { display: grid; place-items: center; width: 1.9em; height: 1.9em; border-radius: 50%; background: color-mix(in oklab, var(--c) 22%, var(--surface)); color: var(--ink); font-size: 1em; }
    .share.live { --c: var(--live); }
    .kind {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--orange-ink);
        font-size: 0.85rem;
        font-weight: 700;
    }
    .share.live .kind { color: var(--ink-2); }
    h2 { font-size: 1.3rem; text-wrap: balance; }
    .body { color: var(--ink-2); }
    form { display: grid; gap: 14px; }
    .digits { max-width: 9ch; font-size: 1.5rem; letter-spacing: 0.25em; text-align: center; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .share > .btn { justify-self: start; }
    video {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: var(--radius-m);
        background: var(--ink);
        object-fit: contain;
    }
</style>
