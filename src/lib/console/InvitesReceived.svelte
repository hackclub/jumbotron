<script>
    // Invites from organizers who added this person by Slack ID. Shown on the setup card (so a
    // new organizer can join instead of naming an event) and in the Organizers panel.
    import { slide } from "svelte/transition";
    import { org, respondInvite } from "$lib/org.svelte.js";

    let { heading = "Invites to organize" } = $props();

    let busy = $state(false);
    let error = $state("");

    let invites = $derived(org.state?.invites ?? []);
    let bridged = $derived(org.state?.role === "bridged");
    let hosting = $derived(!bridged && (org.state?.members?.length ?? 0) > 0);
    let blocked = $derived(bridged
        ? `Leave ${org.state.root.name}'s event first (Organizers tab) to accept.`
        : hosting ? "Remove the other organizers from your event to accept." : "");

    const avatar = (slack) => `https://cachet.hackclub.com/users/${slack}/r`;

    async function respond(host, accept) {
        if (busy) return;
        busy = true;
        error = "";
        try {
            await respondInvite(host, accept);
        } catch (e) {
            error = e.message || "Network error, please try again.";
        } finally {
            busy = false;
        }
    }
</script>

{#if invites.length}
    <section class="invites" aria-labelledby="invites-heading" transition:slide={{ duration: 200 }}>
        <h3 id="invites-heading">{heading}</h3>
        <p class="hint">Accepting makes you an organizer of their event: you share its attendee code, big screen and content.</p>
        <ul>
            {#each invites as inv (inv.code)}
                <li transition:slide={{ duration: 200 }}>
                    <img src={avatar(inv.slack)} alt="" />
                    <span class="who">
                        <strong>{inv.name}</strong>
                        <span class="sub">{inv.cityName ? `${inv.cityName} · ` : ""}code <span class="mono">{inv.code}</span></span>
                    </span>
                    <span class="actions">
                        <button class="btn btn-small btn-primary" disabled={busy || !!blocked} onclick={() => respond(inv.code, true)}>Accept</button>
                        <button class="btn btn-small btn-quiet" disabled={busy} onclick={() => respond(inv.code, false)}>Decline</button>
                    </span>
                </li>
            {/each}
        </ul>
        {#if blocked}<p class="hint">{blocked}</p>{/if}
        {#if error}<p class="error-text" role="alert">{error}</p>{/if}
    </section>
{/if}

<style>
    .invites { display: grid; gap: 8px; }
    h3 { font-size: 1.05rem; }
    ul { list-style: none; margin: 4px 0 0; padding: 0; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
    li:first-child { border-top: 0; }
    img { flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--surface-sunken); object-fit: cover; }
    .who { flex: 1; min-width: 0; display: grid; }
    .sub { color: var(--ink-3); font-size: 0.88rem; }
    .actions { display: inline-flex; gap: 6px; }
</style>
