// VITE_API points a local build at a local backend.
export const API = import.meta.env.VITE_API || "https://api.jumbotron.hackclub.com";
export const AUTH_URL = "https://auth.hackclub.com/oauth/authorize?client_id=e86d4d7eec9c546e6c4700388d4fea7f&redirect_uri=https%3A%2F%2Fjumbotron.hackclub.com%2Fcallback&response_type=code&scope=name+verification_status+slack_id";



//- PROD
// https://auth.hackclub.com/oauth/authorize?client_id=e86d4d7eec9c546e6c4700388d4fea7f&redirect_uri=https%3A%2F%2Fjumbotron.hackclub.com%2Fcallback&response_type=code&scope=name+verification_status+slack_id

//- DEV
// "https://cautious-space-robot-g4jq5wx4vxqv366v-3000.app.github.dev"
// https://auth.hackclub.com/oauth/authorize?client_id=e86d4d7eec9c546e6c4700388d4fea7f&redirect_uri=https%3A%2F%2Fsymmetrical-doodle-69qgr7v97j76f59j7-5173.app.github.dev%2Fcallback&response_type=code&scope=name+verification_status+slack_id

// Identifies this browser tab, so content it publishes isn't applied to it a second time when
// the server echoes the change to every organizer console.
export const TAB_ID = Math.random().toString(36).slice(2, 12);
