<script>
    // Bottom-center toasts: undo after taking something down, and publish failures.
    import { fly } from "svelte/transition";
    import { syncStatus, undoState, undoTakeDown, updateAPI, clearUndo } from "$lib/liveshare.svelte.js";
    import { labelFor } from "./drafts.svelte.js";

    let undoTimer = null;
    $effect(() => {
        if (undoState.key) {
            clearTimeout(undoTimer);
            undoTimer = setTimeout(clearUndo, 8000);
        }
        return () => clearTimeout(undoTimer);
    });
</script>

<div class="toasts" aria-live="polite">
    {#if syncStatus.state === "error"}
        <div class="toast error" role="alert" transition:fly={{ y: 24, duration: 260 }}>
            <span class="icon" translate="no" aria-hidden="true">error</span>
            <p>{syncStatus.message}</p>
            <button class="btn btn-small btn-primary" onclick={() => updateAPI()}>Try again</button>
        </div>
    {/if}
    {#if undoState.key}
        <div class="toast" transition:fly={{ y: 24, duration: 260 }}>
            <p>{undoState.label || labelFor(undoState.key)} {undoState.label === "Announcements" ? "are" : "is"} no longer showing.</p>
            <button class="btn btn-small btn-primary" onclick={undoTakeDown}>
                <span class="icon" translate="no" aria-hidden="true">undo</span>Undo
            </button>
        </div>
    {/if}
</div>

<style>
    .toasts {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 10;
        display: grid;
        gap: 8px;
        width: min(520px, calc(100% - 32px));
        transform: translateX(-50%);
        pointer-events: none;
    }
    .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 10px 10px 18px;
        border-radius: var(--radius-m);
        background: var(--ink);
        color: var(--surface);
        box-shadow: var(--shadow-2);
        pointer-events: auto;
    }
    .toast p { flex: 1; font-weight: 700; }
    .toast.error { background: var(--danger); }
</style>
