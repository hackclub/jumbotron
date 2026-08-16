export const openGate = $state({
    isOpen: false
});

export const liveshareData = $state({
    active: false,
    timestamp: timestamp()
});

function timestamp() {
    let clock = new Date();
    return clock.getTime();
}

export async function updateAPI() {
    if (!openGate.isOpen) {
        return;
    }
    liveshareData.timestamp = timestamp();
    let val = await fetch("https://api.jumbotron.hackclub.com/mutate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            auth: {
                emailAddress: sessionStorage.getItem("liveshareEmail"),
                key:  sessionStorage.getItem("liveshareKey")
            },
            cityName: sessionStorage.getItem("refAuthCity"),
            data: liveshareData
        })
    });
    if (!val.ok) {
        console.log(val.error)
    }
}

export async function startAPI() {
    liveshareData.timestamp = timestamp();
    let val = await fetch("https://api.jumbotron.hackclub.com/mutate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            auth: {
                emailAddress: sessionStorage.getItem("liveshareEmail"),
                key:  sessionStorage.getItem("liveshareKey")
            },
            cityName: sessionStorage.getItem("refAuthCity"),
            data: liveshareData
        })
    });
    if (!val.ok) {
        console.log(val.error)
    }
}