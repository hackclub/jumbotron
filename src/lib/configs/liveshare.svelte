<script>
    import { onMount } from "svelte";
    import { liveshareData, openGate, startAPI, updateAPI } from "$lib/liveshare.svelte.js";
    import {eventName} from "$lib/event.js";

    let ping;

    let paused = $state(false);

    let cityName = $state("");
    onMount(() => {
        cityName = sessionStorage.getItem("refAuthCity").toLowerCase();
        if (sessionStorage.getItem("liveshareKey") == null || sessionStorage.getItem("liveshareKey") == "" || sessionStorage.getItem("liveshareEmail") == null || sessionStorage.getItem("liveshareEmail") == "") {
            return;
        }  
        startAPI();

        window.addEventListener("pagehide", sendDisconnectBeacon);
    })

    function sendDisconnectBeacon() {
        const url = "https://jumbotron.lynn89sudo.hackclub.app/mutate";
        
        // Convert your structured data into standard URL-encoded form properties
        const params = new URLSearchParams();
        params.append("auth", JSON.stringify({
            emailAddress: sessionStorage.getItem("liveshareEmail"), 
            key: sessionStorage.getItem("liveshareKey")
        }));
        params.append("cityName", cityName);
        params.append("data", JSON.stringify({ active: false }));
        
        // This sends as application/x-www-form-urlencoded naturally, bypassing preflights
        const success = navigator.sendBeacon(url, params);
        console.log("Beacon queued via URLSearchParams:", success); 
    }

    function enableLive() {
        if (sessionStorage.getItem("liveshareKey") == null || sessionStorage.getItem("liveshareKey") == "" || sessionStorage.getItem("liveshareEmail") == null || sessionStorage.getItem("liveshareEmail") == "") {
            return;
        }  
        openGate.isOpen = true;
        openGate.paused = false;
        paused = false;
        liveshareData.active = true;
        updateAPI();
        setTimeout(() => {sendDisconnectBeacon()}, 6000);
    }

    function destroy() {
        liveshareData.active = false
        updateAPI();
        openGate.isOpen = false;
        openGate.paused = false;
        paused = false;
    }
    function pause() {
        openGate.isOpen = false;
        openGate.paused = true;
        paused = true;
    }
    function unpause() {
        openGate.isOpen = true;
        openGate.paused = false;
        updateAPI();
        paused = false;
    }
</script>
<style>
    button {
        background-color: rgb(92, 89, 89);
    }
</style>

{#if !openGate.isOpen && paused == false}
<div>
    <p>Show participants displayed content on their own screens</p>
    <p><button class="bigButton" onclick={enableLive}><span translate="no" title="Enable Liveshare" class="material-symbols-outlined">cast</span></button></p>
</div>
{:else}
<p>Liveshare is enabled. Participants can head to <span class="key">jumbotron.hackclub.com/{cityName}</span></p>
<p><strong>Hack Club's Code of Conduct applies to all platforms. Please be mindful of your usage of Jumbotron's servers, and what you upload to them.</strong></p>
<p>{#if !openGate.paused}<button onclick={pause}>Pause Liveshare</button>{:else}<button onclick={unpause}>Unpause Liveshare</button>{/if} <button onclick={destroy}>End Liveshare</button></p>
{#if openGate.paused}<p><i>Liveshare will still display as active to participants while paused; data will not be update</i>d</p>{/if}
{/if}
