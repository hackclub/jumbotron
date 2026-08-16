<script>
    import { base } from "$app/paths";
    import { eventName, refConsole } from "$lib/event";
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { checkCity, proccessCity, cityToLink } from "$lib/event";

    import { slide } from "svelte/transition";

    let city = $state("");
    let isValid = $state(null);

    let liveshareError = $state(null);
    onMount(async () => {
        let urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("code") != null) {
            let val = await fetch("https://api.jumbotron.hackclub.com/createSession", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    code: urlParams.get("code"),
                    cityName: sessionStorage.getItem("refAuthCity")
                })
            });
            if (!val.ok) {
                try {
                    let errPayload = await val.json();
                    // This will print the actual error message sent from your backend!
                    console.error("🔴 Backend Session Creation Error:", errPayload);
                    
                    liveshareError = errPayload.error || `Server responded with status ${val.status}`;
                } catch (e) {
                    liveshareError = `Server error: ${val.status}`;
                }
                let extractedCity = sessionStorage.getItem("refAuthCity");
                if (urlParams.get("eventName") == null) {
                    isValid = false;
                }

                if (extractedCity !== null) {
                    let processed = proccessCity(extractedCity);
                    
                    let result = await checkCity(processed);

                    console.log("Processed City:", processed);
                    console.log("Is Valid Check (actual boolean):", result);

                    isValid = result; 
                    city = extractedCity;
                }
                
            }
            else {
                let information = await val.json();

                sessionStorage.setItem("liveshareKey", information.key);
                sessionStorage.setItem("liveshareEmail", information.emailAddress);
                sessionStorage.removeItem("authCode");
                window.location.href = base + "/" + sessionStorage.getItem("refAuthCity") + "/control/?liveshare=true" 
                return;
            }
        }
        if (urlParams.get("error") != null) {
            liveshareError = urlParams.get("error");
            return;
        }
        let extractedCity = urlParams.get('eventName');
        if (urlParams.get("eventName") == null) {
            isValid = false;
        }

        if (extractedCity !== null) {
            let processed = proccessCity(extractedCity);
            
            let result = await checkCity(processed);

            console.log("Processed City:", processed);
            console.log("Is Valid Check (actual boolean):", result);

            isValid = result; 
            city = extractedCity;
        }
    })

    let inputCity = $state("")

    function cleanedCity(given) {
        let rtn = "";
        for (let i = 0; i < given.length-1; i++) {
            if (given.substring(i, i+1) == " ") {
                rtn += "-";
            }
            else {
                rtn += given.substring(i, i+1);
            }
        }
        rtn += given.substring(given.length-1);
        return rtn;
    }
</script>
<style>
    * {
        margin-left: 30px;
        margin-right: 30px;
    }
    a {
        margin: 0;
    }
    div {
        background-color: rgb(214, 214, 214);
        border: 6px solid grey;
        padding: 20px;
        margin: 20px;
        border-radius: 20px;
        h3 {
            margin-top: 20px;
        }
        h4 {
            margin-top: 10px;
            margin-bottom: 20px;
        }
        button {
            margin: 8px;
            border-radius: 15px;
            padding: 10px; 
        }
    }

    #participant {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        padding: 0;
        border-radius: 0px;
        border: none;
        margin: 0;
        background-color: rgb(212, 209, 209);
        p {
            color: rgb(0, 0, 0);
        }
    }
</style>
<svelte:head>
    <title>Jumbotron</title>
</svelte:head>
<div id="participant">
    <p>If you've found this page as a participant, you probably made a mistake. Please see an organizer!</p>
</div>
<h1 style:font-size=40px style:margin-top=100px><a title="Visit Hack Club Main Site" href="https://hackclub.com"><image style="max-height:40px; margin: 0; margin-right: -15px; margin-left: 15px;  transform: translateY(5px); padding: 0; display:inline" src="https://assets.hackclub.com/icon-rounded.png"></image></a><span style:font-family="Host Grotesk" style:color="#431d22">Jumbotron</span></h1>
<p><i>Keeping your event communications in one console</i></p>
<h2 style:font-size=20px style:margin-top=20px style:margin-bottom=40px>Organizer Landing Page</h2>
{#if liveshareError == null}
<div>
    <h3>Event Name</h3>
    {#if isValid == true}
    <h4>Your event is currently configured for {proccessCity(city)}</h4>
    {:else if isValid == null}
    <p>Loading...</p>
    {:else}
    <h4>You currently have no event configured. Your provided name may not have been in an accepted format.<br>Please use the link provided from <a style:color="black" href={refConsole[1]}>{refConsole[0]}</a> for Jumbotron</h4>
    <form onsubmit={() => {window.location.href = base + "/?eventName=" + cleanedCity(inputCity)}}>
        <p>You can also try to search for your event by entering the name</p>
        <input bind:value={inputCity} placeholder="ie. leafyland" type="text">
    </form>
    {/if}
</div>
{/if}
{#if isValid == true || liveshareError != null}
<div transition:slide>
    {#if liveshareError == null}
    <h3>Login with Hack Club OAuth</h3>
    <p>Logging in is optional; however, Liveshare functionality for your event will not work</p>

    <svg style="display: block; margin: 0 auto;" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414" xmlns="http://www.w3.org/2000/svg" aria-label="profile" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="100" height="100"><path d="M25.698,22.196c0.248,-1.511 0.302,-3.475 0.302,-6.196c0,-2.721 -0.053,-4.685 -0.302,-6.196c-0.235,-1.45 -0.6,-2.127 -0.987,-2.515c-0.388,-0.387 -1.065,-0.752 -2.515,-0.987c-1.511,-0.249 -3.475,-0.302 -6.196,-0.302c-2.721,0 -4.685,0.053 -6.196,0.302c-1.45,0.235 -2.127,0.6 -2.515,0.987c-0.387,0.388 -0.752,1.065 -0.987,2.515c-0.249,1.511 -0.302,3.475 -0.302,6.196c0,2.721 0.053,4.685 0.302,6.196c0.235,1.45 0.6,2.127 0.987,2.515c0.388,0.387 1.065,0.752 2.515,0.987c1.511,0.249 3.475,0.302 6.196,0.302c2.721,0 4.685,-0.053 6.196,-0.302c1.45,-0.235 2.127,-0.6 2.515,-0.987c0.387,-0.388 0.752,-1.065 0.987,-2.515Zm-9.698,5.804c11,0 12,-1 12,-12c0,-11 -1,-12 -12,-12c-11,0 -12,1 -12,12c0,11 1,12 12,12Z"/><path d="M19,14c0,1.683 -0.271,2.241 -0.469,2.456c-0.163,0.176 -0.68,0.544 -2.531,0.544c-1.85,0 -2.367,-0.368 -2.53,-0.544c-0.198,-0.215 -0.47,-0.773 -0.47,-2.456c0,-1.657 1.343,-3 3,-3c1.657,0 3,1.343 3,3Zm0.835,3.977c0.879,-0.804 1.165,-2.104 1.165,-3.977c0,-2.761 -2.238,-5 -5,-5c-2.761,0 -5,2.239 -5,5c0,1.873 0.287,3.173 1.166,3.977c-1.665,0.911 -2.97,2.396 -3.649,4.189c-0.124,0.328 -0.154,0.708 0.051,0.993c0.569,0.789 1.674,-0.111 2.13,-0.97c1.008,-1.897 3.004,-3.189 5.302,-3.189c2.298,0 4.295,1.292 5.303,3.189c0.456,0.859 1.561,1.759 2.129,0.97c0.205,-0.285 0.176,-0.665 0.052,-0.993c-0.68,-1.793 -1.985,-3.278 -3.649,-4.189Z"/></svg>
    <p><button onclick={() => {sessionStorage.setItem("refAuthCity", proccessCity(city)); window.location.href = "https://auth.hackclub.com/oauth/authorize?client_id=e86d4d7eec9c546e6c4700388d4fea7f&redirect_uri=https%3A%2F%2Fjumbotron.hackclub.com%2F&response_type=code&scope=email+verification_status"}}>Continue with HCA <svg style="max-height: 30px; max-width: 30px; margin: 2px; margin-top: 0px; margin-right: 0px; padding: 0px;" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="1.414" xmlns="http://www.w3.org/2000/svg" aria-label="view-forward" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="currentColor" width="256" height="256"><path d="M12.982,23.89c-0.354,-0.424 -0.296,-1.055 0.128,-1.408c1.645,-1.377 5.465,-4.762 6.774,-6.482c-1.331,-1.749 -5.1,-5.085 -6.774,-6.482c-0.424,-0.353 -0.482,-0.984 -0.128,-1.408c0.353,-0.425 0.984,-0.482 1.409,-0.128c1.839,1.532 5.799,4.993 7.2,6.964c0.219,0.312 0.409,0.664 0.409,1.054c0,0.39 -0.19,0.742 -0.409,1.053c-1.373,1.932 -5.399,5.462 -7.2,6.964l-0.001,0.001c-0.424,0.354 -1.055,0.296 -1.408,-0.128Z"/></svg></button></p>
    <p><a href="{base}/{city}/control/" style:color="black">Proceed without logging in</a></p>
    {:else}
    <h3>Continue without Liveshare</h3>
    <h4>Liveshare has had the following issue. You can continue without logging in</h4>
    <p>{liveshareError}</p>
    <p><a href="{base}/{cityToLink(city)}/control/" style:color="black">Continue without OAuth</a></p>
    {/if}
</div>
{/if}
