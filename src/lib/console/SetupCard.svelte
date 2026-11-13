<script>
    import { eventName } from "$lib/event";
    import { internal } from "$lib/liveshare.svelte.js";
    import { API } from "$lib/api.js";
    import { org } from "$lib/org.svelte.js";
    import InvitesReceived from "./InvitesReceived.svelte";

    // `oncancel` is only passed when renaming an event that's already set up.
    let { oncancel, ondone } = $props();

    let cityName = $state(internal.cityName || "");
    let saving = $state(false);
    let errorText = $state("");

    let trimmed = $derived(cityName.trim().replace(/\s+/g, " "));
    let display = $derived(trimmed ? trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1) : "");

    async function save(event) {
        event.preventDefault();
        if (!display) return;
        saving = true;
        errorText = "";
        try {
            const response = await fetch(`${API}/initEvent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: internal.code, password: internal.password, cityName: display })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                errorText = data.error || "Couldn't save the event name. Try again.";
                return;
            }
            internal.cityName = display;
            internal.initComplete = true;
            localStorage.setItem("cityName", display);
            ondone?.();
        } catch {
            errorText = "Can't reach Jumbotron right now. Check your connection and try again.";
        } finally {
            saving = false;
        }
    }
</script>

{#if !oncancel && org.state?.invites?.length}
    <div class="invited">
        <InvitesReceived heading="You've been added as an organizer" />
        <p class="or">Or start your own event</p>
    </div>
{/if}

<form class="setup" onsubmit={save}>
    <div>
        <h2>{oncancel ? "Rename your event" : "Name your event"}</h2>
        <p class="hint">Usually your city. Attendees see it at the top of their screen.</p>
    </div>

    <label class="field">
        <span>City or location</span>
        <input class="input" bind:value={cityName} placeholder="Boston" autocapitalize="words" autocomplete="off" required aria-invalid={!!errorText} />
    </label>

    <p class="preview" aria-live="polite">
        Attendees will see <strong>{eventName} {display || "…"}</strong>
    </p>

    {#if errorText}<p class="error-text" role="alert">{errorText}</p>{/if}

    <div class="actions">
        <button class="btn btn-primary" type="submit" disabled={!display || saving}>
            {saving ? "Saving" : oncancel ? "Save name" : "Continue"}
        </button>
        {#if oncancel}<button class="btn btn-quiet" type="button" onclick={oncancel}>Cancel</button>{/if}
    </div>
</form>

<style>
    .setup { display: grid; gap: 16px; max-width: 460px; }
    h2 { font-size: 1.3rem; }
    .hint { margin-top: 4px; }
    .preview { color: var(--ink-2); }
    .actions { display: flex; gap: 8px; }
    .invited { display: grid; gap: 16px; max-width: 460px; margin-bottom: 20px; }
    .or { display: flex; align-items: center; gap: 12px; color: var(--ink-3); font-size: 0.88rem; font-weight: 700; }
    .or::before, .or::after { content: ""; flex: 1; height: 1px; background: var(--line); }
</style>
