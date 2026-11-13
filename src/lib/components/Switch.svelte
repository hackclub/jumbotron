<script>
    // iOS-style switch. `label` is announced to screen readers; it is not drawn.
    let { checked = false, label, disabled = false, onchange, hidden = false } = $props();
</script>

<button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    {disabled}
    {hidden}
    class="switch"
    class:on={checked}
    onclick={() => onchange?.(!checked)}
>
    <span class="thumb"></span>
</button>

<style>
    .switch {
        flex: none;
        position: relative;
        width: 51px;
        height: 31px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-pill);
        background: var(--line-strong);
        cursor: pointer;
        transition: background-color var(--dur-2) var(--ease-out);
    }
    .switch.on { background: var(--live); }
    .switch[disabled] { opacity: 0.5; cursor: not-allowed; }
    .switch[hidden=true] { display: none }
    .thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        background: var(--surface);
        box-shadow: 0 2px 4px oklch(0.2 0.05 25 / 0.25);
        transition: transform var(--dur-2) var(--ease-out);
    }
    .switch.on .thumb { transform: translateX(20px); }
</style>
