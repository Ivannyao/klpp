const fs = require('fs');
let f = fs.readFileSync('public/klpp-client.js', 'utf8');
f = f.replace('wave.classList.add("active");', 'wave.style.top = ""; wave.classList.add("active");');
fs.writeFileSync('public/klpp-client.js', f);
