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

            if (localStorage.getItem("jumbotron.ytLink") == "" && localStorage.getItem("jumbotron.fileLink") == "" && localStorage.getItem("jumbotron.qrLink") == "") {
                presentation = "";
                presentationType = 0;
                console.log("Cleared presentation");
            }
            else if (localStorage.getItem("jumbotron.ytLink") != "") {
                presentationType = 1;
                presentation = localStorage.getItem("jumbotron.ytLink");
                //setTimeout(() => {document.getElementById("presentation").requestFullscreen();}, 100)
            }
            else if (localStorage.getItem("jumbotron.qrLink") != "") {
                presentationType = 3;
                presentation = localStorage.getItem("jumbotron.qrLink");
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
    @font-face {
        font-family: "VAG Rounded Next Shine";
        src: url("/fonts/Galindo-Regular.ttf");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
    h2 {
        font-family: VAG Rounded Next Shine, Poppins;
    }
    #event {
        padding: 5px;
        z-index: 1000;
        background-color: rgba(67, 99, 141, 0.813);
        border-radius: 35px;
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        width: 40%;
        top: 70px;

        #timeLabel {
            border-radius: 30px;
            background-color: rgb(78, 76, 106);
            margin-left: 10px;
            padding: 10px;
            font-family: VAG Rounded Next Shine, Poppins;
        }
        p {
            color: white;
            font-family: Poppins;
        }

    }
    #event.now {
        animation: eventPulse 1s ease-in-out infinite;
    }
    @keyframes eventPulse {
        0%, 100% {
            box-shadow: 0px 0px 10px 5px rgba(255, 255, 255, 0);
        }
        50% {
            box-shadow: 0px 0px 10px 5px rgba(0, 0, 0, 0.205);
        }
    }

    #announcement {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        top: 30%;
        color: white;
        background-color: #0E387A;
        width: 90%;
        padding: 20px;
        border-radius: 25px;
        z-index: 1000;
        h1 {
                font-family: VAG Rounded Next Shine, Montserrat, Poppins;
            }

        div {
            p {
                color: rgb(255, 255, 255);
                font-size: 20px;
                font-family: Poppins
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
        background-color: #FAF0D4;
        z-index: 1;
        display: none;
    }

    #presentation {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        top: 50%;
        z-index: 1001
    }

    #eventNameDisplay {
        transition: opacity 0.5s ease-in-out;
        transition-delay: 2000;
        h1 {
            font-size: 55px;
            z-index: 1000;
            position: fixed;
            transform: translate(-50%, -50%);
            left: 50%;
            top: 40%;
            font-family: VAG Rounded Next Shine, Montserrat, Poppins;
            color: rgb(67, 33, 65);
                
        }
    }
    #eventNameDisplay h1.hide {
        opacity: 0;
        transition-delay: 2000;
    }

    #background {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        background-color: rgb(101, 69, 87);
        z-index: 0;
    }

    #blanket {
        position: fixed;
        width: 100%;
        transform: translate(-50%, -30%);
        left: 50%;
        animation: blanketUppy 4s ease-in-out infinite;
    }

    @keyframes blanketUppy {
        0%, 100% {
            transform: translate(-50%, -30%);
        }
        50% {
            transform: translate(-50%, -30.5%);
        }
    }

    #wave {
        position: fixed;
        width: 100%;
        transform: translate(-50%, 0) rotate(180deg);
        top: 0%;
        left: 50%;
        opacity: 1;
        z-index: 998;
        transition: top 2s ease-in-out;
        transition-delay: 2s;
    }
    #wave.hide {
        top: -100%;
    }

    #logo {
        position: fixed;
        transform: translate(-50%, -50%);
        top: 30%;
        width: 30%;
        left: 50%;
        z-index: 999;
        transition: opacity 0.5s ease-in-out;
        transition-delay: 2000;
    }
    #logo.hide {
        opacity: 0;
        transition-delay: 2000;
    }

    #ray {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 50%;
        top: 85%;
        z-index: 1000;
        height: 45%;
    }

    #shark {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 63%;
        top: 100px;
        z-index: 1000;
        height: 10%;
    }

    #ray2 {
        position: fixed;
        transform: translate(-50%, -50%);
        left: 35%;
        top: 45px;
        z-index: 1000;
        height: 10%;
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
            z-index: 1003;
        }
    }
</style>
<svelte:window bind:innerHeight={screenY} bind:innerWidth={screenX}></svelte:window>
<svelte:head>
    <title>{proccessEventCity(page.params.city)}</title>
</svelte:head>
<div id="background"></div>
<img src="{base}/images/sunbeam/blanket.png" alt="Blanket design" id="blanket"/>
<img src="{base}/images/sunbeam/ocean.png" alt="Wave" id="wave" class:hide={event[1] != "Now" && announcementOut}/>
{#if event.length > 0}
<div id="event" class:now={event[1] == "Now"} transition:slide>
    <p><strong>{event[0]}</strong> <span id="timeLabel">{event[1]}</span></p>
</div>
{/if}
{#if announcementOut == false}
<div id="announcement-smoke" in:fade out:fade={{delay: 1000}}></div>
<div id="announcement" in:fly={{y:400, duration:1500, delay: 1000}} out:fly={{y:-400, duration:1500}}>
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
    <img src="https://api.qrserver.com/v1/create-qr-code/?data={presentation}&size=450x450" alt="Qr Code"/>
</div>
{/if}
{/if}
<div id="eventNameDisplay">
    <img class:hide={!announcementOut} src="{base}/images/sunbeam/logo.png" alt="Sunbeam" id="logo"/>
    <h1 class:hide={!announcementOut}>{proccessCity(page.params.city)}</h1>
</div>
<img src="{base}/images/sunbeam/ray.png" alt="Stingray" id="ray"/>
{#if event.length != 0}<img transition:blur={{delay: 500}} src="{base}/images/sunbeam/shark.png" alt="Shark" id="shark" /> <img transition:blur={{delay: 500}} src="{base}/images/sunbeam/ray 2.png" alt="Stingray" id="ray2" />{/if}
<!--<div id="eventNameDisplay">
    <h1><span>{eventName}</span><br>{proccessCity(page.params.city)}</h1>
</div>-->