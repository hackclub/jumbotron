<script>
    import { resolve } from "$app/paths";
    import { eventName } from "$lib/event";
    import { internal } from "$lib/liveshare.svelte.js";
    import { org } from "$lib/org.svelte.js";

    // Organizers of someone else's event share that event's code.
    let code = $derived(org.state?.root?.code ?? internal.code);
    let copied = $state(false);
    let copyTimer = null;

    let link = $derived(`jumbotron.hackclub.com/?code=${code ?? ""}`);

    async function copy() {
        try {
            await navigator.clipboard.writeText(`https://${link}`);
            copied = true;
            clearTimeout(copyTimer);
            copyTimer = setTimeout(() => (copied = false), 2000);
        } catch {
            copied = false;
        }
    }
</script>

<section class="ticket" aria-label="Attendee code">
    <div class="code-side">
        <span class="label">Attendees join with</span>
        <span class="code mono" translate="no">{code ?? "····"}</span>
    </div>
    <div class="link-side">
        <button class="copy" class:done={copied} onclick={copy} disabled={!code} title="Yours for all of {eventName}. Renaming your event keeps it.">
            <span class="url mono" translate="no">{link}</span>
            <span class="copy-label"><span class="icon" translate="no" aria-hidden="true">{copied ? "check" : "content_copy"}</span>{copied ? "Copied" : "Copy link"}</span>
        </button>
        <a class="open" href={resolve("/") + `?code=${code ?? ""}`} target="_blank" rel="noopener">
            <span class="icon" translate="no" aria-hidden="true">cast</span>Open attendee view
        </a>
    </div>
</section>

<style>
    .ticket {
        display: flex;
        align-items: stretch;
        border-radius: var(--radius-l);
        background: var(--surface);
        box-shadow: var(--shadow-2);
        overflow: hidden;
    }
    .code-side {
        display: grid;
        align-content: center;
        gap: 2px;
        padding: 16px 24px;
        background: var(--red);
        color: var(--on-color);
    }
    .label { font-size: 0.82rem; font-weight: 700; }
    .code { font-size: 2.8rem; font-weight: 700; letter-spacing: 0.1em; line-height: 1; }

    .link-side { display: grid; align-content: center; gap: 6px; padding: 14px 18px; min-width: 0; }
    .copy {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        padding: 8px 8px 8px 14px;
        border: 0;
        border-radius: var(--radius-pill);
        background: var(--surface-sunken);
        color: var(--ink);
        cursor: pointer;
    }
    .copy:hover { background: var(--surface-raised); }
    .url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.92rem; text-align: left; }
    .copy-label {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: var(--radius-pill);
        background: var(--surface-raised);
        font-weight: 700;
        font-size: 0.85rem;
    }
    .copy.done .copy-label { background: var(--live); color: var(--on-color); }
    .open {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        color: var(--ink-2);
        font-size: 0.88rem;
        font-weight: 700;
        text-decoration: none;
    }
    .open:hover { color: var(--ink); text-decoration: underline; }

    @media (max-width: 560px) {
        .ticket { flex-direction: column; }
        .code-side { padding: 14px 18px; }
    }
</style>
