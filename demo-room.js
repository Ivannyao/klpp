const http = require('http');

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: method,
      headers: {}
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Create room
  const roomRes = await request('/api/klpp/rooms', 'POST');
  const id = roomRes.room.id;
  console.log(`ROOM CREATED: ${id}`);
  
  // Join 3 bots
  for(let i=1; i<=3; i++) {
    await request(`/api/klpp/room/${id}/join`, 'POST', {
      clientId: `bot${i}`,
      nickname: `Bot ${i}`,
      avatar: { color: '#ff6b6b', face: 'smile' }
    });
  }
  
  // Start game
  await request(`/api/klpp/room/${id}/start`, 'POST', { clientId: 'bot1' });
  console.log(`Game started! Open your browser now: http://127.0.0.1:3000/klpp?view=host&room=${id}`);
  
  // Wait 30 seconds for the answer phase to begin and let user look at it
  console.log("Waiting 12 seconds for user to look at Answer screen...");
  await new Promise(r => setTimeout(r, 45000));
  
  // Fetch assignments and answer them
  console.log("Submitting answers to trigger transition to Vote phase...");
  for(let i=1; i<=3; i++) {
    const state = await request(`/api/klpp/room/${id}?clientId=bot${i}`);
    const assignment = state.room.viewer.currentAssignment;
    if (assignment) {
      await request(`/api/klpp/room/${id}/answer`, 'POST', {
        clientId: `bot${i}`,
        pairId: assignment.pairId,
        text: `Answer from bot ${i}`
      });
    }
  }
  
  // The first round of answers is submitted. Players have TWO pairs to answer.
  await new Promise(r => setTimeout(r, 2000));
  for(let i=1; i<=3; i++) {
    const state = await request(`/api/klpp/room/${id}?clientId=bot${i}`);
    const assignment = state.room.viewer.currentAssignment;
    if (assignment) {
      await request(`/api/klpp/room/${id}/answer`, 'POST', {
        clientId: `bot${i}`,
        pairId: assignment.pairId,
        text: `Second answer from bot ${i}`
      });
    }
  }
  
  console.log("All answers submitted! Look at your screen for the wave transition!");
}

run();
