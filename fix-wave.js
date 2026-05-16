const fs = require('fs');
let f = fs.readFileSync('public/klpp-client.js', 'utf8');
f = f.replace('if (prevHostState === "answer" && snap.state === "vote") {', 'if (prevHostState === "answer" && (snap.state === "vote" || snap.state === "vote_result")) {');
fs.writeFileSync('public/klpp-client.js', f);
console.log("Fixed wave condition");
