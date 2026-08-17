# Jumbotron

Welcome to Jumbotron! Jumbotron is a too built on SvelteKit and Node that can be used for Hack Club Satellite events to display scheduled events, announcements, QR Codes, videos, presentations, and documents. All of these can also be accessed by participants directly through Liveshare.

## How Jumbotron was made

Jumbotron is a static SvelteKit project that works through a web browser and two screens

## Running the front-end locally

Open the project and run the following
- npm install
- npm run dev

You should be able to preview the front-end locally

To build changes for proper deployment, run
- npm run build
- Delete the folder called "docs", and rename the new "build" folder
- git to push changes

## Running the back-end locally
The backend is available at /hackclub/jumbotron-backend
Open it locally and run "node index.js" to start it

Important to note is that you may need to create your own auth app and redirect URL, as you cannot directly use Jumbotron's

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
- In event.js: Update the name of the Cockpit/Organizer Portal along with the link, update the name of the Event
- In [city]/display: A new component from lib needs to be implemented. There are template components available

You will also need to talk to someone with access to the backend on updating the list of events.





