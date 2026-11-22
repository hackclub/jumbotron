# Jumbotron

Welcome to Jumbotron! Jumbotron is a too built on SvelteKit and Node that can be used for Hack Club Satellite events to display scheduled events, announcements, QR Codes, videos, presentations, and documents. All of these can also be accessed by participants directly through Liveshare.

## How Jumbotron was made

Jumbotron is one app: a static SvelteKit frontend and an Express API, served together by a single Node server (`server/index.js`). The API lives under `/api`; every other path serves the frontend build. All state is kept in memory, so restarting the server clears events.

### Running locally

You'll need Node 22 or newer.

- `npm install`
- `cp .env.example .env` and fill in what you need (each variable is described in the file)
- `npm run dev`

This starts the API on port 3000 (restarting it when `server/` changes) and Vite on port 5173. Open http://localhost:5173; Vite proxies `/api` to the API, so the app works the same as in production.

Hack Club Auth only redirects to URLs registered for its client, so organizer sign-in won't complete on localhost unless you create your own auth app and set `CLIENT_SECRET` and `REDIRECT` (and the client ID and redirect in `src/lib/api.js`) to match it.

To run the production build locally:

- `npm run build`
- `npm start`, then open http://localhost:3000

### Deploying

Production runs the same Node server, which serves both the frontend and the API. Build and run it with Docker:

- `docker build -t jumbotron .`
- `docker run -p 3000:3000 --env-file .env jumbotron`

Or, without Docker, run `npm ci`, `npm run build` and `npm start` on the host. Put it behind a reverse proxy that terminates TLS and doesn't buffer responses, since the console, big screen and attendee pages hold Server-Sent Events streams open. Run a single instance: state is in memory and isn't shared between processes.

## How to use Jumbotron as an Event Participant

If Liveshare is enabled, you can use it by heading to jumbotron.hackclub.com/[eventName]. For example
- jumbotron.hackclub.com/nyc
- jumbotron.hackclub.com/sydney

This page is designed to be usable on mobile and desktop devices. The page itself will tell you the status of your event's Liveshare, along with accessible content. 

<img width="1373" height="627" alt="Capture d’écran 2026-08-17 à 3 45 46 PM" src="https://github.com/user-attachments/assets/0679c2bc-1ce7-4dc0-94c6-323e93c91f9c" />


## How to use Jumbotron as an Event Organizer

Jumbotron is available at https://jumbotron.hackclub.com
Your event's organizer cockpit or console might also have a link you can use, which doesn't require you to search up your event; however, the link above will allow you to easily search up your city name.

Once your city name is deemed valid, you will be asked whether or not you want to login using Auth (auth.hackclub.com). Using Jumbotron without Liveshare does not require you to be an authenticated user. To use Liveshare, you must be authenticated and YSWS eligible. 

<img width="1369" height="637" alt="Capture d’écran 2026-08-17 à 3 42 44 PM" src="https://github.com/user-attachments/assets/f977b78e-fd8f-4d50-8bab-b6e67a05063c" />

### Organizer Console and Projection

<img width="1423" height="398" alt="Capture d’écran 2026-08-17 à 3 43 37 PM" src="https://github.com/user-attachments/assets/6877cb93-4fbc-4644-8329-473ac9003e0d" />

When you enter the control page, you'll have access to multiple panels. If you're new, you should start by making your Jumbotron display screen. Just as your control page is a webpage, so will your display. You can open a new tab using the button, and then move it to a new window. 

<img width="1458" height="342" alt="Capture d’écran 2026-08-17 à 3 48 46 PM" src="https://github.com/user-attachments/assets/6dca8e0a-eaae-4a12-84e1-d1bce5b4ed25" />

Now that you've set this up, you should move your new window to the TV or projector visible to your participants. Jumbotron is best used with your main laptop screen not visible to participants, and extending to a projector or screen. 

From here, you have access to the other control panels. You can see changes update with the sync indicator on the console and on the display. 

<img width="1450" height="587" alt="Capture d’écran 2026-08-17 à 3 56 53 PM" src="https://github.com/user-attachments/assets/1697a57e-7753-4360-8730-3a0b04cc1d09" />

If you've logged in, you'll also have access to Liveshare at the bottom.

<img width="1460" height="400" alt="Capture d’écran 2026-08-17 à 3 57 26 PM" src="https://github.com/user-attachments/assets/20e8e4a7-4836-4508-8dd2-e6fe9bfd0792" />


## Setting up Jumbotron for a new Satellite

Setting up Jumbotron is made to be as easy as possible. Here's what you'll need to do
- In `src/lib/event.js`: update `eventName`, and point `eventTheme` at the new event's artwork in `static/images/`
- In `src/lib/styles.css`: update the token block at the top (colors, fonts) to match the new event's look. Every page reads from those tokens, so nothing else needs to change

You will also need to talk to someone with access to the server on updating the list of events.






### Big screen and demo time

In the console, **Big screen → Open** opens `/screen`. Move that tab to the laptop plugged into the projector and press Full screen. It signs in with the organizer login saved on that device.

- **Show announcements** puts the current announcement and "up next" on the projector. Turn it off and the screen shows only the event name and join link.
- **Demo time** lets attendees share their screen. The big screen shows a 4-digit screen code. A presenter opens the attendee page on their laptop, taps **Share my screen**, enters their name and that code, then picks a window. The code changes after each presenter. Organizers can see who is presenting and stop them from the console.

The video goes peer-to-peer (WebRTC) from the presenter's laptop to the projector tab. The server only checks the code and relays the connection handshake. Some venue wifi blocks direct connections between devices. If shares get stuck on "Connecting", set `ICE_SERVERS` on the server to a JSON array that includes a TURN server. Phones can't share their screen from a browser, so presenters need a laptop.
