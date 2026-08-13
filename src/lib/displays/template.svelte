<script>
    import { base } from "$app/paths";
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { blur, fade, fly, slide } from "svelte/transition"

    import { eventName, proccessEventCity } from "$lib/event.js";
    import { proccessCity } from "$lib/event.js";
    import { checkCity } from "$lib/event.js";

    let screenY = $state(0);
    let screenX = $state(0);

    onMount(async function() {
        console.log("Checking city name...")
       if (await checkCity(proccessCity(page.params.city)) == true) {
        console.log("City name is valid!")
       }
       else {
        window.location.href = base + "/" // this should eventually link to an error page
       }
    })

    onMount(() => {
        window.addEventListener("keypress", (e) => {
            if (e.key == "f") {
                document.documentElement.requestFullscreen();
                requestWakeLock();
            }
        })
    })

    let event = $state([]);
    let announcement = $state([]);
    let presentation = $state("");
    let presentationType = $state();

    onMount(() => {
        window.addEventListener("storage", (e) => {
            sync();
        })
        setTimeout(function() {sync(true)}, 1000);
    })

    function sync(override) {
        if (localStorage.getItem("jumbotron.sync") == "true" || override) {
            console.log("Started display sync");
            if (localStorage.getItem("jumbotron.event.title") == "" || localStorage.getItem("jumbotron.event.time") == "undefined" || localStorage.getItem("jumbotron.event.time") == "") {
                event = [];
                console.log("Cleared event");
            }
            else {
                event = [localStorage.getItem("jumbotron.event.title"), localStorage.getItem("jumbotron.event.label")]
                console.log("Synced event");
            }
            
            if (localStorage.getItem("jumbotron.announcement.title") == "" && localStorage.getItem("jumbotron.announcement.message") == "") {
                announcementOut = true;
                setTimeout(() => {announcement = [];
                console.log("Cleared announcement");}, 1000)
            }
            else {
                announcementOut = false;
                announcement = [localStorage.getItem("jumbotron.announcement.title"), localStorage.getItem("jumbotron.announcement.message")]
                console.log("Synced announcement");
            }

            if (localStorage.getItem("jumbotron.ytLink") == "" && localStorage.getItem("jumbotron.fileLink") == "") {
                presentation = "";
                presentationType = 0;
                console.log("Cleared presentation");
            }
            else if (localStorage.getItem("jumbotron.ytLink") != "") {
                presentationType = 1;
                presentation = localStorage.getItem("jumbotron.ytLink");
                //setTimeout(() => {document.getElementById("presentation").requestFullscreen();}, 100)
            }
            else {
                presentationType = 2;
                presentation = localStorage.getItem("jumbotron.fileLink");
            }
        }
        console.log("Finished display sync");
        //console.log(event);
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

    let announcementOut = $state(true);
</script>
<style>
    #event {
        padding: 5px;
        background-color: rgba(94, 93, 93, 0.671);
        border-radius: 35px;
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        width: 40%;
        top: 55px;

        #timeLabel {
            border-radius: 30px;
            background-color: grey;
            margin-left: 10px;
            padding: 10px;
        }
        p {
            color: white;
        }

    }
    #event.now {
        animation: eventPulse 1s ease-in-out infinite;
    }
    @keyframes eventPulse {
        0%, 100% {
            box-shadow: 0px 0px 10px 5px rgba(0, 0, 0, 0);
        }
        50% {
            box-shadow: 0px 0px 10px 5px rgba(0, 0, 0, 0.205);
        }
    }

    #announcement {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        top: 50%;
        background-color: grey;
        color: white;
        width: 90%;
        padding: 20px;
        border-radius: 25px;
        z-index: 1000;

        div {
            padding: 5px;
            margin: 10px;
            margin-top: 20px;
            border-radius: 20px;
            background-color: rgb(102, 102, 102);
            p {
                color: white;
                font-size: 20px;
            }
        }

        .margin-down {
            margin-bottom: 40px;
        }
    }
    #announcement-smoke {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(44, 44, 44, 0.971);
        z-index: 999
    }

    #presentation {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        top: 50%;
        z-index: 998
    }

    #eventNameDisplay {
        position: fixed;
        left: 20px;
        bottom: 20px;
        h1 {
            color: rgb(85, 40, 14);
            font-size: 90px;
            text-align: left;

            span {
                color: rgb(188, 103, 54);
            }
        }
    }

    #background {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        background-color: white;
        z-index: 0;
    }

    #qrBlanket {
        z-index: 1002;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        background-color: white;
        h2 {
            position: fixed;
            transform: translate(-50%, -50%);
            left: 50%;
            top: 20%;
            font-size: 50px;
        }
        img {
            position: fixed;
            transform: translate(-50%, -50%);
            left: 50%;
            top: 50%;
        }
    }
</style>
<svelte:window bind:innerHeight={screenY} bind:innerWidth={screenX}></svelte:window>
<svelte:head>
    <title>{proccessEventCity(page.params.city)}</title>
</svelte:head>
<div id="background"></div>
{#if event.length > 0}
<div id="event" class:now={event[1] == "Now"} transition:slide>
    <p><strong>{event[0]}</strong> <span id="timeLabel">{event[1]}</span></p>
</div>
{/if}
{#if announcementOut == false}
<div id="announcement-smoke" in:fade out:fade={{delay: 1000}}></div>
<div id="announcement" in:fly={{y:400, duration:1500, delay: 1000}} out:fly={{y:400, duration:1500}}>
    {#if announcement[0] != ""}<h1 class:margin-down={announcement[1] == ""}>{announcement[0]}</h1>{/if}
    <!--<span class="material-symbols-outlined">circle_notifications</span>-->
    {#if announcement[1] != ""}
    <div>
        <p>{announcement[1]}</p>
    </div>
    {/if}
</div>
{/if}
{#if presentation != ""}
{#if presentationType == 1}
<iframe transition:blur id="presentation" width={screenX-10} height={screenY-10} src={presentation} title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
{:else if presentationType == 2}
<iframe id="presentation" src={presentation} width={screenX-10} height={screenY-10} title="Google Docs viewer"></iframe>
{:else if presentationType == 3}
<div id="qrBlanket">
    <h2>Scan this code!</h2>
    <img src="https://api.qrserver.com/v1/create-qr-code/?data={presentation}&size=300x300" alt="Qr Code"/>
</div>
{/if}
{/if}
<div id="eventNameDisplay">
    <h1><span>{eventName}</span><br>{proccessCity(page.params.city)}</h1>
</div>