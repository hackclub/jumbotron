<script>
    import { eventName } from "$lib/event.js";
    import { checkCity, proccessCity } from "$lib/event.js";
    import { page } from "$app/state";
    import { onMount } from "svelte";

    import { blur } from "svelte/transition";

    let cityLink = "";
    let boxes = $state({});

    let p2 = $state("We're checking if Liveshare is enabled for this event.");

    onMount(async function() {
        console.log("Checking city name...");
        try {
            if (await checkCity(proccessCity(page.params.city)) == true) {
                console.log("City name is valid!");
                cityLink = await proccessCity(page.params.city);
            } else {
                p2 = "No liveshare session was found for this event. If you believe this is a mistake, please see an organizer.";
                return;
            }
        } catch(err) {
            p2 = "No liveshare session was found for this event. If you believe this is a mistake, please see an organizer.";
            return;
        }

        let eventSource = new EventSource(`https://jumbotron.lynn89sudo.hackclub.app/stream?cityName=${proccessCity(page.params.city)}`);
        eventSource.onmessage = (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed && !parsed.message) {
                boxes = parsed;
                console.log("Stream updated", boxes);
                if (boxes.active === false) {
                    p2 = "Liveshare is no longer enabled for this event; it is available, and can be enabled by an organizer. It is recommended to reload this page once Liveshare is re-enabled.";
                    boxes = {};
                } else {
                    if (p2 !== "Liveshare is enabled. You should see active notifications for events, presentations, videos, and announcements below.") {
                        p2 = "Liveshare is enabled. You should see active notifications for events, presentations, videos, and announcements below.";
                    }
                }
            }
        };

        try {
            let raw = await fetch(`https://jumbotron.lynn89sudo.hackclub.app/data?eventName=${cityLink}`);
            let liveshare = await raw.json();
            console.log(liveshare);
            if (liveshare.data.active == true) {
                p2 = "Liveshare is enabled. You should see active notifications for events, presentations, videos, and announcements below.";
                boxes = liveshare.data;
            } else {
                p2 = "Liveshare is not currently enabled for this event; it is available, and can be enabled by an organizer. Reload this page once an organizer activates Liveshare.";
            }
        } catch(err) {
            p2 = "Your event was found; however, there was an error with finding the Liveshare information. See an organizer if you need Liveshare.";
        }
    });

    function sanitizeLink(link) {
        if (link.indexOf("http") == -1) {
            return "https://" + link;
        } else {
            return link;
        }
    }
</script>

<style>
    p, h1, h2, h3 {
        text-align: start;
        margin-left: 25px;
        margin-right: 25px;
    }
    .box {
        background-color: lightgrey;
        padding: 10px;
        border-radius: 20px;
        border: darkgrey solid 5px;
        margin: 25px;
        padding-top: 20px;
    }
</style>

<svelte:head>
    <title>{eventName} Liveshare</title>
</svelte:head>

<h1>
    <span style:font-weight="800">Welcome to</span> 
    <span>{eventName} {proccessCity(page.params.city)}</span>
</h1>
<h2 style:font-family="Atkinson Hyperlegible Mono, Montserrat" style:font-size="20px">Liveshare Portal</h2>

<div>
    <p><output aria-live="polite">{p2}</output></p>
    <p>
        <button onclick={() => window.location.href = ``}>
            Reload page
        </button>
    </p>
</div>

<div aria-live="polite" aria-atomic="true">
    {#if boxes.announcement}
        <div class="box" transition:blur>
            <h3>Announcement: <output>{boxes.announcement.title}</output></h3>
            {#if boxes.announcement.message && boxes.announcement.message !== ""}
                <p style:margin-top="20px"><output>{boxes.announcement.message}</output></p>
            {:else}
                <p><i>No message is attached to this announcement</i></p>
            {/if}
        </div>
    {/if}

    {#if boxes.event}
        <div class="box" transition:blur>
            <h3>Event: <output>{boxes.event.title}</output></h3>
            <p style:margin-top="20px">
                This takes place at <output>{boxes.event.time}</output>
            </p>
        </div>
    {/if}

    {#if boxes.presentation}
        <div class="box" transition:blur>
            {#if boxes.presentation.indexOf("youtube.com") !== -1} 
                <h3>A YouTube video is being displayed</h3>
                <p>
                    <button onclick={() => window.location.href = sanitizeLink(boxes.presentation)}>
                        View the video
                    </button>
                </p>
            {:else if boxes.presentation.indexOf("drive.google.com") !== -1}
                <h3>A document is being shared</h3>
                <p>
                    <button onclick={() => window.location.href = sanitizeLink(boxes.presentation)}>
                        View the document
                    </button>
                </p>
            {:else}
                <h3>A QR Code is being shared</h3>
                <p>
                    <button onclick={() => window.location.href = sanitizeLink(boxes.presentation)}>
                        View the website
                    </button>
                </p>
            {/if}
        </div>
    {/if}
</div>