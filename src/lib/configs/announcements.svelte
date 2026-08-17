<script>
    import { base } from "$app/paths";
    import { page } from "$app/state";
    import { slide } from "svelte/transition";

    import { sync } from "$lib/sync.svelte.js";
    import { tutorial } from "$lib/sync.svelte.js";
    import { onMount } from "svelte";

    import { liveshareData, updateAPI } from "$lib/liveshare.svelte.js"


    let consoleMode = $state(0);

    let announcementTitle = $state("");
    let announcementMessage = $state("");
    let eventsTitle = $state("");

    let eventTimeInput = $state([9,30])
    if (true) {
        let clock = new Date();
        eventTimeInput[0] = clock.getHours();
        eventTimeInput[1] = clock.getMinutes();
    }

    let time = new Date();
    let placeholderTime = $state("09:30"); 

    let pmString = $state("AM");
    let pmMax = $state(23);
    onMount(() => {
        let clock = new Date();
        if (clock.getHours() >= 12) {
            pmString = "PM";
        }
        sanitizeTime();
    })

    let timerID = "";
    let timerChange = 0;

    let announcementOn = $state(false);
    let eventOn = $state(false);

    function toggle(type) {
        if (type == 0) {
            if (announcementOn) {
                announcementOn = false;
                liveshareData.announcement = null;
                //updateAPI();
            }
            else {
                announcementOn = true;
                liveshareData.announcement = {
                    title: announcementTitle,
                    message: announcementMessage
                }
                //updateAPI();
            }
        }
        else if (type == 1) {
            if (eventOn) {
                eventOn = false;
                liveshareData.event = null;
                //updateAPI();
            }
            else {
                eventOn = true;
                liveshareData.event = {
                    title: eventsTitle,
                    time: formatTimeLabel(eventTimeInput)
                }
                //updateAPI();
            }
        }
        syncAnnouncements(announcementOn, eventOn);
    }

    function update(type) {
        event.preventDefault();
        if (type == 0) {
            if (announcementMessage == "" && announcementTitle == "") {
                toggle(0);
            }
            else {
                syncAnnouncements(true, null);
            }
        }
        else if (type == 1) {
            if (eventsTitle == "" || eventTimeInput[0] === "" || eventTimeInput[1] === "") {
                toggle(1);
            }
            else {
                syncAnnouncements(null, true);
            }
        }
    }

    function sanitizeTime() {
        if (parseInt(eventTimeInput[0]) == 0 && formatLabel == "AM/PM" && pmString == "AM") {
            eventTimeInput[0] = 12;
        }
        if (eventTimeInput[0] < 0) {
            eventTimeInput[0] = 12;
        }
        if (eventTimeInput[0] > 24) {
            eventTimeInput[0] = 12;
        }
        if (eventTimeInput[1] < 0) {
            eventTimeInput[1] = 0;
        }
        if (eventTimeInput[1] == 60) {
            eventTimeInput[0] += 1;
            eventTimeInput[1] = 0;
            sanitizeTime();
            return;
        }
        if (eventTimeInput[1] > 60) {
            eventTimeInput[1] = eventTimeInput[1]-60;
            eventTimeInput[0] += 1;
            sanitizeTime();
            return;
        }
        if (eventTimeInput[0] <= 9 && formatLabel == "International") {
            if ((eventTimeInput[0] + "").length != 2) {
                eventTimeInput[0] = "0" + eventTimeInput[0];
            }
        }
        if (eventTimeInput[1] <= 9) {
            if ((eventTimeInput[1] + "").length != 2) {
                eventTimeInput[1] = "0" + eventTimeInput[1];
            }
        }
        
    }

    let formatLabel = $state("International")
    function switchFormat() {
    if (formatLabel === "AM/PM") {
        // Switch to International (24-Hour)
        formatLabel = "International";
        pmMax = 23;

        if (pmString === "PM" && eventTimeInput[0] < 12) {
            // 1 PM -> 13, 11 PM -> 23
            eventTimeInput[0] += 12;
        } else if (pmString === "AM" && eventTimeInput[0] === 12) {
            // 12 AM -> 0 (Midnight)
            eventTimeInput[0] = 0;
        }
        sanitizeTime();
    } else {
        // Switch to AM/PM (12-Hour)
        formatLabel = "AM/PM";
        pmMax = 12;

        if (eventTimeInput[0] === 0) {
            // 00:xx -> 12:xx AM
            eventTimeInput[0] = 12;
            pmString = "AM";
        } else if (eventTimeInput[0] === 12) {
            // 12:xx -> 12:xx PM
            pmString = "PM";
        } else if (eventTimeInput[0] > 12) {
            // 13:xx to 23:xx -> 1:xx PM to 11:xx PM
            eventTimeInput[0] -= 12;
            pmString = "PM";
        } else {
            // 1:xx to 11:xx -> 1:xx AM to 11:xx AM
            pmString = "AM";
        }
        sanitizeTime();
    }
}

    onMount(function() {
           localStorage.setItem("jumbotron.announcement.title", "");
            localStorage.setItem("jumbotron.announcement.message", "");
            localStorage.setItem("jumbotron.event.title", "");
            localStorage.setItem("jumbotron.event.time", "");
            localStorage.setItem("jumbotron.event.label", "");
    })


    /*
    onMount(function() {
        
        placeholderTime = "";
        if (time.getHours() == 0) {
            placeholderTime += "12:";
            if (time.getMinutes() <= 9) 
                placeholderTime += "0";
            }
            placeholderTime += time.getMinutes();
            placeholderTime += " AM";
        }
        else if (time.getHours() > 11) {
            placeholderTime += (time.getHours() - 12);
            placeholderTime += ":";
            if (time.getMinutes() <= 9) {
                placeholderTime += "0";
            }
            placeholderTime += time.getMinutes();
            placeholderTime += " PM";
        }
        else {
            placeholderTime += (time.getHours());
            placeholderTime += ":";
            if (time.getMinutes() <= 9) {
                placeholderTime += "0";
            }
            placeholderTime += time.getMinutes();
            placeholderTime += " AM";
        }
            
    });

    */

    function formatTimeLabel(raw) {
        let minutes = String(raw[1]).padStart(2, "0");
        if (formatLabel == "International") {
            return raw[0] + ":" + minutes;
        } else {
            return raw[0] + ":" + minutes + " " + pmString;
        }
    }

    function formatToInternational() {
        let hours = parseInt(eventTimeInput[0]) || 0;
        let minutes = String(eventTimeInput[1] ?? 0).padStart(2, "0");

        if (formatLabel === "AM/PM") {
            if (pmString === "PM" && hours < 12) {
                hours += 12; // e.g., 1 PM -> 13
            } else if (pmString === "AM" && hours === 12) {
                hours = 0;   // e.g., 12 AM -> 0
            }
        }

        return String(hours).padStart(2, "0") + ":" + minutes;
    }

    function syncAnnouncements(o1, o2) {
        sync.announcements = true;
        localStorage.setItem("jumbotron.sync", false);
        clearInterval(timerID);
        timerID = "";
        timerChange = 0;
        if (o1) {
            localStorage.setItem("jumbotron.announcement.title", announcementTitle);
            localStorage.setItem("jumbotron.announcement.message", announcementMessage);
            liveshareData.announcement = {
                    title: announcementTitle,
                    message: announcementMessage
                }
        }
        else if (o1 == false) {
            localStorage.setItem("jumbotron.announcement.title", "");
            localStorage.setItem("jumbotron.announcement.message", "");
            liveshareData.announcement = null;
        }
        if (o2) {
            localStorage.setItem("jumbotron.event.title", eventsTitle);
            localStorage.setItem("jumbotron.event.time", formatToInternational(eventTimeInput));
            localStorage.setItem("jumbotron.event.label", formatTimeLabel(eventTimeInput));
            setTimeout(setAlarm, 1000);
            liveshareData.event = {
                    title: eventsTitle,
                    time: formatTimeLabel(eventTimeInput)
                }
        }
        else if (o2 == false) {
            localStorage.setItem("jumbotron.event.title", "");
            localStorage.setItem("jumbotron.event.time", "");
            localStorage.setItem("jumbotron.event.label", "");
            liveshareData.event = null;
        }
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true;}, 2000);
        setTimeout(function() {sync.announcements = false; localStorage.setItem("jumbotron.sync", false); sync.liveshare = false; updateAPI();}, 3000);
    }

    function setAlarm() {
        // 1. Guard against blank or invalid inputs
        if (
            eventsTitle === "" || 
            eventTimeInput[0] == null || eventTimeInput[0] === "" ||
            eventTimeInput[1] == null || eventTimeInput[1] === ""
        ) {
            return;
        }

        // 2. Clear any existing active timer interval to prevent leaks
        if (timerID) {
            clearInterval(timerID);
            timerID = "";
        }

       let goodFormat = formatToInternational(eventTimeInput);
       let hours = goodFormat.split(":")[0]
       let minutes = goodFormat.split(":")[1]
       

        // Target time (t1) and current time (t2) in total minutes from midnight
        let t1 = (parseInt(hours) * 60) + parseInt(minutes);
        let time = new Date();
        let t2 = (time.getHours() * 60) + time.getMinutes();

        // 4. Start the countdown interval
        timerID = setInterval(() => {
            time = new Date();
            t2 = (time.getHours() * 60) + time.getMinutes();
            let diff = t1 - t2;

            if (diff <= 0) {
                localStorage.setItem("jumbotron.event.label", "Now");
                localStorage.setItem("jumbotron.sync", "true");
                setTimeout(() => {
                    localStorage.setItem("jumbotron.sync", "false");
                    clearInterval(timerID);
                    timerID = "";
                }, 1000);
            } else if (diff === 1) {
                localStorage.setItem("jumbotron.event.label", "In 1 minute");
                if (timerChange !== diff) {
                    timerChange = diff;
                    localStorage.setItem("jumbotron.sync", "true");
                    setTimeout(() => {
                        localStorage.setItem("jumbotron.sync", "false");
                    }, 1000);
                }
            } else if (diff <= 30) {
                localStorage.setItem("jumbotron.event.label", "In " + diff + " minutes");
                if (timerChange !== diff) {
                    timerChange = diff;
                    localStorage.setItem("jumbotron.sync", "true");
                    setTimeout(() => {
                        localStorage.setItem("jumbotron.sync", "false");
                    }, 1000);
                }
            }
        }, 2000);
    }

    onMount(async () => {
        const is24Hour = !new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
        .resolvedOptions()
        .hourCycle.startsWith('h1');

        if (!is24Hour) {
            switchFormat();
        }
    })
    
</script>

<style>
    form {
        input {
            margin: 8px;
            border-radius: 15px;
            padding: 10px; 
        }
    }
    button {
        background-color: rgb(92, 89, 89);
    }
    button.disabled {
        cursor: progress;
    }
    button.incomplete {
        cursor: not-allowed
    }

    button.option {
        background-color: white;
        color: rgb(97, 96, 96);
    }
    h4 {
        margin-top: 35px;
    }

    .box {
        border-radius: 5px;
    }
    #number1 {
        margin-right: 0;
        width: 60px;
    }
    #number2 {
        margin-left: 0;
        margin-right: 0;
        width: 60px;
    }
    .pushLeft {
        margin-right: 15px !important;
    }
    button.box {
        padding: 5px;
        margin-left: 0;
    }
</style>
<table style:margin-top=0px style:margin-bottom=5px>
<!--This was originally a table for a different format, but we don't need it-->
    <tbody>
        <tr>
            <td>
                <p>
                    <button class="bigButton" class:toggleOn={consoleMode == 1} title="Configure Announcement" onclick={() => {consoleMode == 1 ? consoleMode = 0 : consoleMode = 1}}><span translate="no" class="material-symbols-outlined">campaign</span></button>
                    <button class="bigButton" class:toggleOn={consoleMode == 2} title="Configure Event" onclick={() => {consoleMode == 2 ? consoleMode = 0 : consoleMode = 2}}><span translate="no" class="material-symbols-outlined">calendar_add_on</span></button>
                </p>
            </td>
        </tr>
        {#if consoleMode == 1}
        <tr>
            <td>
                <div class="subconsole">
                    <h4>Announcements</h4>
                    <p>One or both fields must contain content in order to display</p>
                    {#if tutorial.enabled}<p>You can modify the announcement popup by filling out the form fields below. The popup will appear when you sync the display window while the form fields contain content, and the popup will dissapear when you sync the display window and the form fields contain no content.</p>{/if}
                    <form>
                        <input required bind:value={announcementTitle} type = "text" placeholder="Title"><br>
                        <input required bind:value={announcementMessage} class="bigInput" type="text" placeholder="Message">
                        <br>
                        {#if !announcementOn}<button disabled={sync.announcements || (announcementMessage == "" && announcementTitle == "")} onclick={function() {toggle(0);}} class:disabled={sync.announcements} class:incomplete={announcementMessage == "" && announcementTitle == ""}>Display Announcement</button>{:else}<button disabled={sync.announcements} onclick={function() {toggle(0);}} class:disabled={sync.announcements}>Hide Announcement</button> <button disabled={sync.announcements} onclick={function() { update(0)}} class:disabled={sync.announcements}>Sync Announcement</button>{/if}
                    </form>
                </div>
            </td>
        </tr>
        {:else if consoleMode == 2}
        <tr>
            <td>
                <div class="subconsole">
                    <h4>Scheduled Event</h4>
                    <p>International Format will display the time of your event in the 24-hour clock; AM/PM format will display the time of your event in the 12-hour clock.</p>
                    {#if tutorial.enabled}<p>You can modify the upcoming event module by filling out the form fields below. The module will appear when you sync the display window while the form fields contain content, and will count down the time until your event when 30 minutes or less remain. The module will dissapear when you sync the display window and the form fields contain no content.</p>{/if}
                    <form>
                        <input bind:value={eventsTitle} type="text" placeholder="Title">
                        <!--<input bind:value={eventsTime} type="time" placeholder={placeholderTime}>-->
                        
                        <input type="number" min={pmMax == 12 ? 1 : 0} max={pmMax} onblur={sanitizeTime} class="box" id="number1" placeholder={placeholderTime.split(":")[0]} bind:value={eventTimeInput[0]}>
                        <span>:</span>
                        <input type="number" min=0 max=59 class="box" onblur={sanitizeTime} class:pushLeft={formatLabel == "International"} id="number2" placeholder={placeholderTime.split(":")[1]} bind:value={eventTimeInput[1]}>
                        {#if formatLabel == "AM/PM"}
                        <button type="button" class="box option" onclick={() => {pmString == "AM" ? pmString = "PM" : pmString = "AM"}}>{pmString}</button>
                        {/if}
                        <button type="button" style:margin-left=10px disabled={sync.announcements} class="option" onclick={switchFormat}> Displaying {formatLabel}</button>

                        <!--{#if formatLabel == "International"}
                        <button type="button" class="box option" onclick={() => {pmString == "AM" ? pmString = "PM" : pmString = "AM"}}>{pmString}</button>
                        <button disabled={sync.announcements} class="option" onclick={switchFormat}>Displaying AM/PM Format</button>
                        {:else}
                        <button disabled={sync.announcements} class="option" onclick={switchFormat}>Displaying International Format</button>
                        {/if}-->
                        <br>
                        {#if !eventOn}<button disabled={sync.announcements || eventsTitle == "" || eventTimeInput[0] === "" || eventTimeInput[1] === ""} onclick={function() {sanitizeTime(); toggle(1);}} class:disabled={sync.announcements} class:incomplete={eventsTitle === "" || eventTimeInput[0] === "" || eventTimeInput[1] === ""}>Display Event</button>{:else}<button disabled={sync.announcements} onclick={function() { sanitizeTime(); update(1)}} class:disabled={sync.announcements}>Sync Event</button> <button disabled={sync.announcements} onclick={function() {toggle(1);}} class:disabled={sync.announcements}>Hide Event</button>{/if}
                    </form>
                </div>
            </td>
        </tr>
        {/if}
    </tbody>
</table>

<!--<p><button class:disabled={sync.announcements} onclick={syncAnnouncements} disabled={sync.announcements}>Sync Announcements and Events on Display Windows</button></p>-->


