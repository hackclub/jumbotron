<script>

    import { base } from "$app/paths";
    import { page } from "$app/state";
    import { onMount } from "svelte";

    import { proccessEventCity } from "$lib/event.js";
    import { proccessCity } from "$lib/event.js";
    import { checkCity } from "$lib/event.js";

    import MainConfig from "$lib/configs/main.svelte";
    import AnnouncementConfig from "$lib/configs/announcements.svelte";
    import Slides from "$lib/configs/slides.svelte";
    import Liveshare from "$lib/configs/liveshare.svelte";
    import { sync, tutorial } from "$lib/sync.svelte";

    import { openGate } from "$lib/liveshare.svelte.js";

    let liveshareEnabled = $state(false);
    let liveshareAway = $state(false);
    onMount(function() {
        let params = new URLSearchParams(window.location.search);
        if (params.get("liveshare") == "true") {
            liveshareEnabled = true;
            setTimeout(() => {liveshareAway = true}, 1000);
            setTimeout(() => {liveshareAway = false}, 3500);
            if (sessionStorage.getItem("liveshareKey") == null || sessionStorage.getItem("liveshareKey") == "" || sessionStorage.getItem("liveshareEmail") == null || sessionStorage.getItem("liveshareEmail") == "") {
                window.location.href = base + "/?eventName=" + page.params.city;
            }
        }
        else {
            sessionStorage.removeItem("authCode");
        }
    })

    onMount(async function() {
        console.log("Checking city name...")
       if (await checkCity(proccessCity(page.params.city)) == true) {
        console.log("City name is valid!")
       }
       else {
        window.location.href = base + "/" // this should eventually link to an error page
       }
    })

    function toggleTut() {
        if (tutorial.enabled) {
            tutorial.enabled = false;
        }
        else {
            tutorial.enabled = true;
        }
    }

    function forceSync() {
        localStorage.setItem("jumbotron.sync", true);
        sync.enabled = true;
        setTimeout(() => {localStorage.setItem("jumbotron.sync", false); sync.enabled = false;}, 2000)
    }
    

    let wakeLock = null;

    // Replace your existing requestWakeLock and onMount logic with this:

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log("WakeLock enabled");
                
                wakeLock.addEventListener("release", () => {
                    console.log("WakeLock was released");
                });
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    }

    onMount(() => {
        requestWakeLock();

        // Re-request lock if the tab was hidden and comes back to focus
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    onMount(() => {requestWakeLock();})
</script>

<svelte:head>
    <title>Control Window | Jumbotron</title>
</svelte:head>
<style>
    .config {
        margin: 20px;
        background-color: rgb(231, 231, 231);
        padding: 20px;
        padding-top: 30px;
        border-radius: 30px;
        border: 5px grey solid;
        h3 {
            margin-bottom: 10px;
        }
        
    }
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        50% {
            transform: rotate(180deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    #liveshareNotif {
        user-select: none;
        z-index: 1000;
        position: fixed;
        right: -305px;
        top: 90px;
        background-color: #635758f2;
        border-radius: 20px;
        color: white;
        padding: 0px;
        transition: all 0.5s ease-in-out;
        border: 5px solid #ec374f00;

        span {
            transform: translateY(5px);
            margin-right: 20px;
        }
        p {
            transform: translateY(-3px);
            padding-right: 50px;
        }
    }
    #liveshareNotif.away {
        right: -25px;
        background-color: #ec374ff2;
    }
    #liveshareNotif.active {
        right: -235px;
        animation: pulsate infinite 2s ease-in-out;
    }
    #liveshareNotif.pause {
        right: -235px;
        background-color: #635758f2;
    }
    #liveshareNotif.up {
        top: 10px;  
    }
    @keyframes pulsate {
        0%, 100% {
            background-color: #db5164fd;
        }
        50% {
            background-color: #ec374f;
        }
    }

    #syncingNotif {
        z-index: 999;
        user-select: none;
        position: fixed;
        right: -200px;
        top: 10px;
        background-color: #635758f2;
        border-radius: 20px;
        color: white;
        padding: 0px;
        transition: all 0.5s ease-in-out;
        border: 5px solid #ec374f00;

        span {
            transform: translateY(5px);
            margin-right: 20px;
        }
        p {
            transform: translateY(-3px);
            padding-right: 50px;
        }
    }
    #syncingNotif.active {
        animation: pulsate infinite 2s ease-in-out;
        right: -70px;
        background-color: #ec374ff2;
        span {
            animation: spin 1s infinite ease-in;
        }
        p {
            transform: translateY(2.5px);
        }
    }
</style>
<!--
    #syncingNotif {
        position: fixed;
        z-index: 1000;
        transform: translate(-50%, -50%);
        bottom: -550px;
        left: 50%;
        transition: all 0.7s ease-in-out;
        background-color: rgba(177, 82, 82, 0.948);
        box-shadow: 0px 0px 20px 10px rgba(0, 0, 0, 0.237);
        border-radius: 40px;
        padding: 20px;
        p {
            color: white;
        }
    }
    #syncingNotif.active {
        bottom: 10px;
    }
-->
<h1>{proccessEventCity(page.params.city)}</h1>
<h2 style:font-size=20px style:font-weight=400 style:margin-bottom=30px>Jumbotron Control Panel</h2>
<svg style="display: block; margin: 0 auto" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414" xmlns="http://www.w3.org/2000/svg" aria-label="admin" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="100" height="100"><path d="M21.437 17.023a1 1 0 0 1 .785.977v2.2H23a1 1 0 0 1 .907 1.42l-2.222 4.8a1 1 0 0 1-1.907-.42v-2.2H19a1 1 0 0 1-.907-1.42l2.222-4.8a1 1 0 0 1 1.122-.557zM19.834 16.977C20.714 16.173 21 14.873 21 13a5 5 0 0 0-10 0c0 1.873.286 3.173 1.165 3.977a8.029 8.029 0 0 0-3.6 4.062c-.162.408-.213.939.162 1.168.792.485 1.632-.457 2.105-1.257a5.997 5.997 0 0 1 5.48-2.942c1.132.058 2.373-.055 3.24-.784a8.75 8.75 0 0 0 .282-.247zM19 13c0 1.683-.271 2.241-.47 2.456-.162.176-.68.544-2.53.544-1.85 0-2.368-.368-2.53-.544C13.27 15.24 13 14.683 13 13a3 3 0 1 1 6 0z"/></svg>
<p>You should keep this window open on your laptop or main screen, and open the display window on another screen.</p>
<p>Jumbotron will not work across different browsers (ie. Safari, Chrome)</p>
<!--<p style:margin-bottom=40px><button onclick={toggleTut}>{#if tutorial.enabled}Hide Tutorial{:else}Show Tutorial{/if}</button></p>-->
<p style:margin-bottom=40px><button onclick={window.location.href = base + "/"}>
    <svg style="display: block; margin: 0 auto;" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414" xmlns="http://www.w3.org/2000/svg" aria-label="view-back" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="30" height="30"><path d="M19.768,23.89c0.354,-0.424 0.296,-1.055 -0.128,-1.408c-1.645,-1.377 -5.465,-4.762 -6.774,-6.482c1.331,-1.749 5.1,-5.085 6.774,-6.482c0.424,-0.353 0.482,-0.984 0.128,-1.408c-0.353,-0.425 -0.984,-0.482 -1.409,-0.128c-1.839,1.532 -5.799,4.993 -7.2,6.964c-0.219,0.312 -0.409,0.664 -0.409,1.054c0,0.39 0.19,0.742 0.409,1.053c1.373,1.932 5.399,5.462 7.2,6.964l0.001,0.001c0.424,0.354 1.055,0.296 1.408,-0.128Z"/></svg>
    Return to Landing Page 
</button></p>

<div id="main" class="config">
    <h3>Main Configuration</h3>
    <p>Manage and Create Display Windows</p>
    <MainConfig />
</div>
<div id="events" class="config">
    <h3>Announcements and Events</h3>
    <p>Display real-time information easily</p>
    <AnnouncementConfig title=""/>
</div>
<div id="presentations" class="config">
    <h3>Presentations</h3>
    <p>Display slides, documents, and videos</p>
    <Slides />
</div>
{#if liveshareEnabled}
<div id="liveshare" class="config">
    <h3>Liveshare</h3>
    <Liveshare />
</div>
{/if}
{#if liveshareEnabled}
<div id="liveshareNotif" class:away={liveshareAway} class:active={openGate.isOpen} class:up={!sync.enabled && !sync.announcements && !sync.slides} class:pause={openGate.paused}>
    <p style:color="white"><strong><span translate="no" class="material-symbols-outlined">podcasts</span> Liveshare Available</strong></p>
</div>
{/if}
<div id="syncingNotif" class:active={sync.enabled || sync.announcements || sync.slides}>
    <p style:color="white"><strong><span translate="no" class="material-symbols-outlined">sync</span></strong></p>
</div>