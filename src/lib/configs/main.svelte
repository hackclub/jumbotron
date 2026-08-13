<script>
    import { base } from "$app/paths";
    import { page } from "$app/state";
    import { onMount } from "svelte";

    import { sync } from "$lib/sync.svelte.js";
    import { tutorial } from "$lib/sync.svelte.js";

    onMount(function() {
        localStorage.setItem("jumbotron.error", "");
       setTimeout(function() {localStorage.setItem("jumbotron.sync", true);}, 1000);
       setTimeout(function() {localStorage.setItem("jumbotron.sync", false);}, 2000);
    })

    function openDisplay() {
        window.open(base + "/" + page.params.city + "/display", "_blank");
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true);}, 2000);
       setTimeout(function() {localStorage.setItem("jumbotron.sync", false);}, 3000);
    }
    function syncDisplay() {
        sync.enabled = true;
        document.getElementById("sync").disabled = true;
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true)}, 2000)
        setTimeout(function() {sync.enabled = false; document.getElementById("sync").disabled = false; localStorage.setItem("jumbotron.sync", false)}, 3000)
    }
    function fullscreen() {
        document.documentElement.requestFullscreen();
    }

</script>
<style>
    button {
        background-color: rgb(92, 89, 89);
    }
</style>
{#if tutorial.enabled}<p>Display windows should be moved to another screen.</p>{/if}
<!--<p><button onclick={openDisplay}>Open New Display Window</button></p>-->
<p><button class="bigButton" title="Open Display Window" onclick={openDisplay}><span translate="no" class="material-symbols-outlined">add_to_queue</span></button></p>
{#if tutorial.enabled}<p>New windows are not automatically synced. Sync the windows using the buttons for each section below.</p>{/if}
<p>To enter fullscreen on your display window, press <span class="key">f key</span> in the display.</p>
<p>To exit fullscreen, press <span class="key">esc key</span> in the display.</p> 
