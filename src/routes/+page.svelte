<script>
    import { resolve } from "$app/paths";
    import { API, AUTH_URL } from "$lib/api.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { onMount, tick } from "svelte";
    import { slide, fade } from "svelte/transition";
    import { eventName } from "$lib/event";
    import Backdrop from "$lib/components/Backdrop.svelte";
    import Wordmark from "$lib/components/Wordmark.svelte";

    let digits = $state(["", "", "", ""]);
    let inputs = [];
    let status = $state("idle"); // idle | checking | error
    let errorText = $state("");
    let joining = $state(null); // { city } while following an invite link
    let joinTimer = null;
    let organizerOpen = $state(false);
    let hasCreds = $state(false);

    let code = $derived(digits.join(""));

    onMount(async () => {
        hasCreds = !!localStorage.getItem("creds");

        const linkCode = page.url.searchParams.get("code");
        if (linkCode) {
            fill(linkCode, 0);
            const result = await lookup(linkCode);
            if (result.ok) {
                // Invite links get a short, cancellable pause so a shared screen can't hijack the page.
                joining = { city: result.data.cityName || "" };
                joinTimer = setTimeout(enter, 1500);
            }
        }
    });

    async function lookup(value) {
        status = "checking";
        errorText = "";
        try {
            const response = await fetch(`${API}/getPacket?code=${encodeURIComponent(value)}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.error) {
                status = "error";
                errorText = response.status === 429
                    ? data.error || "Too many wrong codes. Wait a few minutes and try again."
                    : `No event uses code ${value}. Check the code on the screen, or ask an organizer.`;
                return { ok: false };
            }
            sessionStorage.setItem("eventPacket", JSON.stringify(data));
            sessionStorage.setItem("eventCode", value);
            status = "idle";
            return { ok: true, data };
        } catch {
            status = "error";
            errorText = "Can't reach Jumbotron right now. Check your connection and try again.";
            return { ok: false };
        }
    }

    function enter() {
        goto(resolve("/attendee"));
    }

    function cancelJoin() {
        clearTimeout(joinTimer);
        joining = null;
        tick().then(() => inputs[3]?.focus());
    }

    // Spread typed, pasted or autofilled digits across the boxes starting at `from`.
    function fill(text, from) {
        const incoming = String(text).replace(/\D/g, "").slice(0, 4 - from).split("");
        incoming.forEach((d, i) => (digits[from + i] = d));
        return from + incoming.length;
    }

    async function submitIfComplete() {
        if (code.length !== 4 || status === "checking") return;
        const result = await lookup(code);
        if (result.ok) {
            enter();
        } else {
            await tick();
            inputs[0]?.focus();
            inputs[0]?.select();
        }
    }

    function onInput(event, index) {
        const raw = event.target.value;
        digits[index] = "";
        const next = fill(raw, index);
        event.target.value = digits[index];
        if (status === "error") status = "idle";
        if (next > index) inputs[Math.min(next, 3)]?.focus();
        submitIfComplete();
    }

    function onPaste(event, index) {
        event.preventDefault();
        const next = fill(event.clipboardData.getData("text"), index);
        inputs[Math.min(next, 3)]?.focus();
        submitIfComplete();
    }

    function onKeydown(event, index) {
        if (event.key === "Backspace" && !digits[index] && index > 0) {
            event.preventDefault();
            digits[index - 1] = "";
            inputs[index - 1].focus();
        } else if (event.key === "ArrowLeft" && index > 0) {
            inputs[index - 1].focus();
        } else if (event.key === "ArrowRight" && index < 3) {
            inputs[index + 1].focus();
        } else if (event.key === "Enter") {
            submitIfComplete();
        }
    }
</script>

<svelte:head>
    <title>Join {eventName} · Jumbotron</title>
</svelte:head>

<Backdrop mascot={!joining} />

<div class="page">
    <header>
        <Wordmark onArt />
    </header>

    <main>
        {#if joining}
            <div class="joining" in:fade={{ duration: 200 }} role="status">
                <span class="spinner" aria-hidden="true"></span>
                <h1>Joining {eventName}{joining.city ? ` ${joining.city}` : ""}</h1>
                <button class="btn btn-on-art" onclick={cancelJoin}>Cancel</button>
            </div>
        {:else}
            <form class="join" onsubmit={(e) => { e.preventDefault(); submitIfComplete(); }}>
                <h1 id="join-heading">Join {eventName}</h1>
                <p class="lede" id="join-hint">Enter the 4-digit code shown at your event.</p>

                <div class="boxes" role="group" aria-labelledby="join-heading" aria-describedby="join-hint">
                    {#each digits as digit, index}
                        <!-- SvelteKit resets focus after navigation unless an element has autofocus. -->
                        <!-- svelte-ignore a11y_autofocus -->
                        <input
                            autofocus={index === 0 && !page.url.searchParams.get("code")}
                            bind:this={inputs[index]}
                            value={digit}
                            class:filled={digit}
                            type="text"
                            inputmode="numeric"
                            autocomplete={index === 0 ? "one-time-code" : "off"}
                            maxlength="4"
                            aria-label="Digit {index + 1} of 4"
                            aria-invalid={status === "error"}
                            disabled={status === "checking"}
                            oninput={(e) => onInput(e, index)}
                            onpaste={(e) => onPaste(e, index)}
                            onkeydown={(e) => onKeydown(e, index)}
                            onfocus={(e) => e.target.select()}
                        />
                    {/each}
                </div>

                <div class="feedback" aria-live="polite">
                    {#if status === "checking"}
                        <p class="checking"><span class="spinner small" aria-hidden="true"></span> Checking code</p>
                    {:else if status === "error"}
                        <p class="callout" role="alert" transition:slide={{ duration: 200 }}>
                            <span class="icon" translate="no" aria-hidden="true">error</span>{errorText}
                        </p>
                    {/if}
                </div>
            </form>

            <section class="organizer" aria-label="Organizers">
                {#if hasCreds}
                    <a class="btn btn-on-art org-btn" href={resolve("/staff")}>
                        <span class="icon" translate="no" aria-hidden="true">admin_panel_settings</span>
                        Open your organizer console
                    </a>
                {:else if !organizerOpen}
                    <button class="btn btn-on-art org-btn" onclick={() => (organizerOpen = true)} aria-expanded="false">
                        <span class="icon" translate="no" aria-hidden="true">admin_panel_settings</span>
                        Organizer? Sign in
                    </button>
                {:else}
                    <div class="org-panel" transition:slide={{ duration: 260 }}>
                        <h2>Sign in as an organizer</h2>
                        <p>Use your Hack Club account. It needs to be verified and YSWS-eligible to run Jumbotron.</p>
                        <div class="org-actions">
                            <a class="btn btn-primary" href={AUTH_URL}>Continue with Hack Club Auth</a>
                            <button class="btn btn-quiet" onclick={() => (organizerOpen = false)}>Cancel</button>
                        </div>
                    </div>
                {/if}
            </section>
        {/if}
    </main>
</div>

<style>
    .page {
        min-height: 100dvh;
        display: grid;
        grid-template-rows: auto 1fr;
        padding: 40px 16px 120px;
        color: var(--on-art);
    }
    header { text-align: center; }

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 40px;
        padding-top: clamp(32px, 10vh, 96px);
        text-align: center;
    }

    h1 {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: clamp(2.4rem, 7vw, 3.6rem);
        line-height: 1.05;
        text-shadow: 0 2px 12px oklch(0.2 0.05 25 / 0.35);
    }
    .lede { margin-top: 10px; font-size: 1.15rem; opacity: 0.92; }

    .boxes {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 28px;
    }
    .boxes input {
        width: 64px;
        height: 76px;
        padding: 0;
        border: 2px solid transparent;
        border-radius: var(--radius-m);
        background: oklch(0.985 0.01 75 / 0.92);
        color: var(--ink);
        font: 700 2rem/1 var(--font-mono);
        text-align: center;
        caret-color: var(--accent-strong);
        box-shadow: var(--shadow-2);
        transition: border-color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out), background-color var(--dur-1) var(--ease-out);
    }
    .boxes input:focus { outline: none; border-color: var(--accent); transform: translateY(-2px); }
    .boxes input.filled { background: oklch(0.985 0.012 88); }
    .boxes input[aria-invalid="true"] { border-color: var(--danger); }
    .boxes input:disabled { opacity: 0.7; }

    .feedback { min-height: 64px; margin-top: 16px; display: flex; justify-content: center; }
    .checking { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
    .callout {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        max-width: 420px;
        padding: 12px 16px;
        border-radius: var(--radius-m);
        background: var(--surface);
        color: var(--ink);
        text-align: left;
        box-shadow: var(--shadow-2);
    }
    .callout .icon { color: var(--danger); }

    .organizer { display: flex; justify-content: center; width: 100%; }
    .org-btn {
        min-height: 54px;
        padding: 0 1.5rem;
        border-radius: 14px;
        font-size: 1.12rem;
    }
    .org-btn .icon { font-size: 1.35rem; }

    .org-panel {
        width: min(500px, 100%);
        padding: 28px 28px 24px;
        border-radius: var(--radius-l);
        background: var(--surface);
        color: var(--ink);
        text-align: left;
        box-shadow: var(--shadow-2);
    }
    .org-panel h2 { font-size: 1.45rem; }
    .org-panel p { margin-top: 8px; color: var(--ink-2); font-size: 1.05rem; }
    .org-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    .org-actions .btn { min-height: 52px; padding: 0 1.4rem; font-size: 1.05rem; border-radius: 14px; }

    .joining { display: grid; justify-items: center; gap: 20px; }

    .spinner {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 4px solid oklch(1 0 0 / 0.3);
        border-top-color: var(--on-art);
        animation: spin 0.9s linear infinite;
    }
    .spinner.small { width: 16px; height: 16px; border-width: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 400px) {
        .boxes { gap: 8px; }
        .boxes input { width: 56px; height: 68px; }
    }
</style>
