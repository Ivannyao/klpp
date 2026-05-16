const http = require('http');
async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: 3000, path: path, method: method, headers: {} };
    if (body) opts.headers['Content-Type'] = 'application/json';
    const req = http.request(opts, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function run() {
  const roomRes = await request('/api/klpp/rooms', 'POST');
  const id = roomRes.room.id;
  for(let i=1; i<=4; i++) {
    await request(`/api/klpp/room/${id}/join`, 'POST', { clientId: `bot${i}`, nickname: `Bot ${i}`, avatar: { color: ['#ff0000','#00ff00','#0000ff','#ffff00'][i-1], face: 'smile' } });
  }
  await request(`/api/klpp/room/${id}/settings?clientId=bot1`, 'POST', { answerSeconds: 5, voteSeconds: 5, roundCount: 1 });
  await request(`/api/klpp/room/${id}/start`, 'POST', { clientId: 'bot1' });
  console.log(`Game started! FAST GAME: http://127.0.0.1:3000/klpp?view=host&room=${id}`);
  
  await new Promise(r => setTimeout(r, 8000)); // 8 seconds wait
  
  // Spam answers & votes until finished
  for(let i=0; i<60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const state = await request(`/api/klpp/room/${id}?clientId=bot1`);
    
    if(state.room.state === 'answer') {
      for(let b=1; b<=4; b++) {
        const s2 = await request(`/api/klpp/room/${id}?clientId=bot${b}`);
        const assignment = s2.room.viewer.currentAssignment;
        if (assignment) {
          await request(`/api/klpp/room/${id}/answer`, 'POST', { clientId: `bot${b}`, pairId: assignment.pairId, text: `A${b}` });
        }
      }
    }
    else if(state.room.state === 'vote') {
      for(let b=1; b<=4; b++) {
        const s2 = await request(`/api/klpp/room/${id}?clientId=bot${b}`);
        if(s2.room.viewer.vote && s2.room.viewer.vote.canVote && !s2.room.viewer.vote.chosenClientId) {
          await request(`/api/klpp/room/${id}/vote`, 'POST', { clientId: `bot${b}`, pairId: s2.room.viewer.vote.pairId, chosenClientId: s2.room.viewer.vote.leftClientId });
        }
      }
    }
    else if(state.room.state === 'finished' || state.room.state === 'round_score') {
      console.log('REACHED SCOREBOARD');
      break;
    }
  }
}
run();
