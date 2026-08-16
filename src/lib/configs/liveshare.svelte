<script>
    import { onMount } from "svelte";
    import { liveshareData, openGate, startAPI, updateAPI } from "$lib/liveshare.svelte.js";
    import {eventName} from "$lib/event.js";
    import { slide } from "svelte/transition";

    let ping;

    let forceUpdateTimer = $state(0);
    onMount(() => {
        setInterval(() => {
            if (forceUpdateTimer > 0) {
                forceUpdateTimer--;
            }
        }, 5000);
    })


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
    .wait:hover {
        cursor: not-allowed;
    }
</style>

{#if !openGate.isOpen && paused == false}
<div>
    <p>Show participants displayed content on their own screens</p>
    <p><button class="bigButton" onclick={enableLive}><span translate="no" title="Enable Liveshare" class="material-symbols-outlined">cast</span></button></p>
</div>
{:else}
<p>Liveshare is enabled. Participants can head to <span class="key">jumbotron.hackclub.com/{cityName}</span></p>

<div class="subconsole">
    <p>{#if !openGate.paused}<button onclick={() => {updateAPI(); forceUpdateTimer = 3;}} disabled={forceUpdateTimer > 0} class:wait={forceUpdateTimer > 0}>Force Update</button> <button onclick={pause}>Pause Liveshare</button>{:else}<button onclick={unpause}>Unpause Liveshare</button>{/if} <button onclick={destroy}>End Liveshare</button></p>
    <p>When sharing files, websites, or videos, participants have unrestricted access.</p>

</div>
{#if openGate.paused}<p><i>Liveshare will still display as active to participants while paused; data will not be update</i>d</p>{/if}
{#if forceUpdateTimer > 0}<p transition:slide><strong><i>Force update can be used every 15 seconds</i></strong></p>{:else}<p>Liveshare should update automatically; however, you can use <strong>Force Update</strong> if needed</p>{/if}
{/if}
