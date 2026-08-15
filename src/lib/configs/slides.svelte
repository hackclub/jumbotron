<script>
    import { base } from "$app/paths";
    import { page } from "$app/state";
    import { onMount, unmount } from "svelte";
    import { slide } from "svelte/transition";

    import { sync } from "$lib/sync.svelte.js";
    import { tutorial } from "$lib/sync.svelte.js";
    import { liveshareData, updateAPI } from "$lib/liveshare.svelte.js"

    let consoleMode = $state(0);

    //let googleLink = $state("");
    let fileLink = $state("");
    let ytLink = $state("");
    let qrLink = $state("");
    let mountedEnabled = $state(false);

    onMount(function() {
        //localStorage.setItem("jumbotron.googleLink", "");
        localStorage.setItem("jumbotron.fileLink", "");
        localStorage.setItem("jumbotron.ytLink", "");
        localStorage.setItem("jumbotron.qrLink", "");
    })

    //https://docs.google.com/viewer?url=YOUR_PUBLIC_FILE_URL&embedded=true

    /*
    $effect(function() {
        if (sync.enabled == true) {

            localStorage.setItem("jumbotron.announcement.title", announcementTitle);
            localStorage.setItem("jumbotron.announcement.message", announcementMessage);
            localStorage.setItem("jumbotron.event.title", eventsTitle);
            localStorage.setItem("jumbotron.event.time", eventsTime);

        }
    })
    */

    /*
    function syncAnnouncements() {
        sync.announcements = true;
        document.getElementById("sync").disabled = true;
        localStorage.setItem("jumbotron.announcement.title", announcementTitle);
        localStorage.setItem("jumbotron.announcement.message", announcementMessage);
        localStorage.setItem("jumbotron.event.title", eventsTitle);
        localStorage.setItem("jumbotron.event.time", eventsTime);
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true)}, 2000);
        setTimeout(function() {sync.announcements = false; localStorage.setItem("jumbotron.sync", false); document.getElementById("sync").disabled = false}, 3000)
    }
        */

        /*
    function enableGoogle() {
        sync.slides = true;
        document.getElementById("google").disabled = true;
        if (googleLink.indexOf("<iframe") != -1) {
            let str = googleLink.split(`"`);
            localStorage.setItem("jumbotron.googleLink", str[1]);
        }
        else {
            localStorage.setItem("jumbotron.googleLink", googleLink);
        }
        localStorage.setItem("jumbotron.fileLink", "");
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true;}, 2000);
        setTimeout(function() {sync.slides = false; localStorage.setItem("jumbotron.sync", false); sync.liveshare = false; document.getElementById("google").disabled = false; mountedEnabled = true;}, 3000)
        setTimeout(() => {checkLink(localStorage.getItem("jumbotron.googleLink"), "google")}, 3500);
    }
        */

    function enableFile() {
        sync.slides = true;
        localStorage.setItem("jumbotron.ytLink", "");
        localStorage.setItem("jumbotron.qrLink", "");
        let split = fileLink.split("/");
        let link = `https://drive.google.com/file/d/${split[5]}/preview`
        if (fileLink.indexOf("<iframe src=") != -1) {
            link = fileLink.split('"')[1];
        }
        localStorage.setItem("jumbotron.fileLink", link);
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true; mountedEnabled = true;}, 2000);
        setTimeout(function() {sync.slides = false; localStorage.setItem("jumbotron.sync", false); sync.liveshare = false; document.getElementById("file").disabled = false; mountedEnabled = true;}, 3000);
        liveshareData.presentation = link;
        updateAPI();
    }

    function enableYoutube() {
        sync.slides = true;
        localStorage.setItem("jumbotron.fileLink", "");
        localStorage.setItem("jumbotron.qrLink", "");
        //https://www.youtube.com/embed/tB46WSVuWnY
        let link = `https://www.youtube.com/embed/${getYTID(ytLink)}`
        localStorage.setItem("jumbotron.ytLink", link);
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true; mountedEnabled = true;}, 2000);
        setTimeout(function() {sync.slides = false; localStorage.setItem("jumbotron.sync", false); sync.liveshare = false; document.getElementById("file").disabled = false; mountedEnabled = true;}, 3000);
        liveshareData.presentation = ytLink;
        //console.log(ytLink);
        updateAPI();
    }

    function enableQR() {
        sync.slides = true;
        localStorage.setItem("jumbotron.fileLink", "");
        localStorage.setItem("jumbotron.ytLink", "");
        //https://www.youtube.com/embed/tB46WSVuWnY
        let link = qrLink
        localStorage.setItem("jumbotron.qrLink", link);
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true; mountedEnabled = true;}, 2000);
        setTimeout(function() {sync.slides = false; localStorage.setItem("jumbotron.sync", false); sync.liveshare = false; document.getElementById("file").disabled = false; mountedEnabled = true;}, 3000);
        liveshareData.presentation = qrLink;
        //console.log(ytLink);
        updateAPI();
    }

    function unmountDisplay() {
        sync.slides = true;
        //localStorage.setItem("jumbotron.googleLink", "");
        localStorage.setItem("jumbotron.fileLink", "");
        localStorage.setItem("jumbotron.ytLink", "");
        localStorage.setItem("jumbotron.qrLink", "");
        mountedEnabled = false;
        setTimeout(function() {localStorage.setItem("jumbotron.sync", true); sync.liveshare = true; mountedEnabled = false;}, 2000);
        setTimeout(function() {localStorage.setItem("jumbotron.sync", false); sync.slides = false; sync.liveshare = false;}, 3000);
        liveshareData.presentation = null;
        updateAPI();
    }

    async function checkLink(link, type) {
        return true;
        /*
        console.log(type)
        if (type == "google") {
            console.log("Checking google link");
            if (link.indexOf("https://docs.google.com/presentation") == -1 || link.indexOf("pubembed") == -1) {
                unmountDisplay();
                window.alert("The format of the provided link does not match with Google Slides. Link will be unmounted from displays.");
                return;
            }
        }
        else if (type == "file") {
            console.log("Checking file link"); //https://drive.google.com/file/d/16AS73qqHN1bS1YzrjH34Fel4h7o2tuIV/view?usp=share_link
            if (link.indexOf("https://drive.google.com/file") == -1 || link.indexOf("view?usp=share_link") == -1) {
                unmountDisplay();
                window.alert("The format of the provided link does not match with Google Drive. Link will be unmounted from displays.");
                return;
            }
        }
            */
        let check = await fetch(link);
        //console.log(check.ok)
        if (!check.ok) {
            unmountDisplay();
            window.alert("Provided link does not work. Link will be unmounted from displays.");
            return;
        }
    }

    let savedLinks = [];
    function modifyLinks(mode, link) {
        if (mode) {
            savedLinks.push(link);
        }
        else {
            savedLinks = savedLinks.filter((item) => item != link);
        }
    }

    // This is an AI generated function; I still don't understand why my function didn't work while this does... but if it works it works
    function getYTID(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
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
    h4 {
        margin-top: 35px;
    }
</style>
{#if !mountedEnabled}
<div transition:slide>
    <p>
        <button class="bigButton" class:toggleOn={consoleMode == 1} onclick={() => {consoleMode == 1 ? consoleMode = 0 : consoleMode = 1}}><span class="material-symbols-outlined" title="Display Google Drive File" translate="no">drive_export</span></button>
        <button class="bigButton" class:toggleOn={consoleMode == 2} onclick={() => {consoleMode == 2 ? consoleMode = 0 : consoleMode = 2}}><span class="material-symbols-outlined" title="Display YouTube Video" translate="no">video_library</span></button>
        <button class="bigButton" class:toggleOn={consoleMode == 3} title="Configure QR Code" onclick={() => {consoleMode == 3 ? consoleMode = 0 : consoleMode = 3}}><span translate="no" class="material-symbols-outlined">qr_code</span></button>
    </p>
<!--
    <h4>Google Slides</h4>
    {#if tutorial.enabled}<p>To display a Google Slides Presentation on your display windows, go to your Google Slides Presentation, find <i>Publish to Web</i>, choose Embed, copy and then paste the provided link below. You can also copy the entire embed given by Google.</p>{/if}
    <form> 
        <input bind:value={googleLink} class="bigInput" type="url" placeholder="https://docs.google.com/presentation...">
    </form>
    <p><button onclick={enableGoogle} id="google" class:disabled={sync.slides}>Display Google Slides on Display Windows</button></p>
    {#if tutorial.enabled}<p>Note that your progression through the slides are individual to the display window. Multiple display windows will not progress through the slides together.</p>{/if}
-->
    {#if consoleMode == 1}
        <div class="subconsole">
            <h4>Google Drive Files</h4>
            {#if tutorial.enabled}<p>To mount a file on your display window, you will need to find your file in Google Drive. From there, find share and <span class="key">copy</span> the link. Paste that link below. This will also work for Google Slides.</p>{/if}
            <p>You should confirm that your document is publically accessible. </p>
            <p>To display a Google Slides Presentation on your display windows, go to your Google Slides Presentation, find <i>Publish to Web</i>, choose <i>Embed</i>, <span class="key">copy</span> and then <span class="key">paste</span> the provided link below. You can also copy the entire embed given by Google.</p>
            <form> 
                <input bind:value={fileLink} class="bigInput" type="url" placeholder="https://drive.google.com/file...">
            </form>
            {#if tutorial.enabled}<p>Note that your progression through the document is individual to the display window, and you will need to use scroll or arrow keys to navigate the document. Multiple display windows will not progress through the document together.</p>{/if}
            <p><button onclick={enableFile} id="file" class:disabled={sync.slides} class:incomplete={fileLink.length == 0} disabled={sync.slides || fileLink.length == 0}>Display File on Display Windows</button></p>
        </div>

    {:else if consoleMode == 2}
        
        <div class="subconsole">
            <h4>YouTube Videos</h4>
            <p><span class="key">Copy</span> the link of a YouTube video directly, and then <span class="key">paste</span> it below</p>
            {#if tutorial.enabled}<p>To mount a video on your display window, you will need to copy the link from your browser.</p>{/if}
            <form> 
                <input bind:value={ytLink} class="bigInput" type="url" placeholder="https://www.youtube.com/watch...">
            </form>        
            {#if tutorial.enabled}<p>Note that your progression through the video is individual to the display window. Multiple display windows will not progress through the video together.</p>{/if}
            <p><button onclick={enableYoutube} id="youtube" class:disabled={sync.slides} class:incomplete={ytLink.length == 0} disabled={sync.slides || ytLink.length == 0}>Display Video on Display Windows</button></p>
        </div>

    {:else if consoleMode == 3}
        
        <div class="subconsole">
            <h4>QR Code</h4>
            <p><span class="key">Copy</span> and <span class="key">paste</span> your link below.</p>
            <form> 
                <input bind:value={qrLink} class="bigInput" type="url" placeholder="https://hackclub.com...">
            </form>       
            {#if tutorial.enabled}<p>Note that your progression through the video is individual to the display window. Multiple display windows will not progress through the video together.</p>{/if}
            <p><button onclick={enableQR} id="qrcode" class:disabled={sync.slides} class:incomplete={qrLink.length == 0} disabled={sync.slides || qrLink.length == 0}>Display QR code on Display Windows</button></p>
        </div>
    {/if}
</div>
{:else}
<div transition:slide>
    <p>Your content should now be mounted on your display windows. Use the button below to unmount your content. Content cannot be changed until unmounted.</p>
    <!--{#if sync.liveshare}<p>Note that participants who have connection to your liveshare have unrestricted access to your file/presentation; pages and slides are not limited to your current progression through the document. It is additionally imperative that your public access link does not grant editing permissions.</p>{/if}-->
    <p><button onclick={unmountDisplay}>Unmount Content from Display Windows</button></p>
</div>
{/if}