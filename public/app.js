const socket = io();
let currentRoomCode = null, myId = null;

const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const btnAddBot = document.getElementById('btn-add-bot');
const btnRemoveBot = document.getElementById('btn-remove-bot');
const btnStart = document.getElementById('btn-start');
const chkBozbey = document.getElementById('chk-bozbey');

socket.on('connect', () => { 
    myId = socket.id; 
});
socket.on('errorMsg', alert);

socket.on('investigationLoyaltyResult', (data) => {
    alert(`INVESTIGATION REPORT:\nPlayer "${data.name}" belongs to the ${data.party} Party alignment.`);
});

document.getElementById('btn-create').onclick = () => {
    const name = document.getElementById('username').value.trim();
    if(name) socket.emit('createRoom', name);
};

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('username').value.trim();
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    if(name && code) socket.emit('joinRoom', { roomCode: code, playerName: name });
};

btnStart.onclick = () => {
    if(currentRoomCode) socket.emit('startGame', currentRoomCode);
};

btnAddBot.onclick = () => {
    if(currentRoomCode) socket.emit('addBot', currentRoomCode);
};

// Wired event listener loop to remove bots
btnRemoveBot.onclick = () => {
    if(currentRoomCode) socket.emit('removeBot', currentRoomCode);
};

chkBozbey.onchange = () => {
    if (currentRoomCode) {
        socket.emit('toggleBozbeyMode', { roomCode: currentRoomCode, enabled: chkBozbey.checked });
    }
};

socket.on('roomCreated', (code) => {
    currentRoomCode = code;
    document.getElementById('display-code').textContent = code;
    setupScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
});

socket.on('gameStateUpdate', (state) => {
    currentRoomCode = state.roomCode;
    
    if (state.status === 'LOBBY') {
        setupScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        document.getElementById('lobby-count').textContent = state.players.length;
        
        chkBozbey.checked = state.bozbeyMode;
        
        // Count how many bots are currently active in the incoming player layout stream
        const botCount = state.players.filter(p => p.id.startsWith('bot_')).length;

        if (state.amIHost) {
            btnStart.classList.remove('hidden');
            btnAddBot.classList.remove('hidden');
            chkBozbey.disabled = false;
            
            // Show the remove button only if the host has actually added some bots
            if (botCount > 0) {
                btnRemoveBot.classList.remove('hidden');
            } else {
                btnRemoveBot.classList.add('hidden');
            }
        } else {
            btnStart.classList.add('hidden');
            btnAddBot.classList.add('hidden');
            btnRemoveBot.classList.add('hidden');
            chkBozbey.disabled = true;
        }

        const list = document.getElementById('player-list');
        list.innerHTML = '';
        state.players.forEach(p => {
            const li = document.createElement('li');
            li.className = "animate-fade";
            li.textContent = p.name;
            list.appendChild(li);
        });
    } 
    else if (state.status === 'IN_PROGRESS') {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        document.getElementById('deck-count').textContent = state.deckCount;
        document.getElementById('discard-count').textContent = state.discardCount;

        updateChaosTracker(state.electionTracker);

        const badge = document.getElementById('role-badge');
        badge.textContent = `Secret Role: ${state.yourRole}`;
        
        if (state.yourRole === 'Bozbey') {
            badge.style.color = '#e040fb'; 
        } else {
            badge.style.color = state.yourRole === 'Liberal' ? '#2196f3' : '#f44336';
        }

        document.getElementById('current-phase-text').textContent = `PHASE: ${state.phase.replace(/_/g, ' ')}`;
        
        renderTrack('liberal-slots-track', state.liberalPolicies, 5, 'Liberal', state.players.length);
        renderTrack('fascist-slots-track', state.fascistPolicies, 6, 'Fascist', state.players.length);
        
        const pList = document.getElementById('game-players-list');
        pList.innerHTML = '';
        state.players.forEach(p => {
            const row = document.createElement('div');
            row.className = `player-row-card ${p.isDead ? 'dead-player' : ''} ${p.isDisconnected ? 'disconnected-player' : ''} ${(p.isPresident || p.isChancellor) ? 'active-gov' : ''}`;
            
            let badges = '';
            if(p.isPresident) badges += `<span class="badge-tag pres">PRESIDENT</span>`;
            if(p.isChancellor) badges += `<span class="badge-tag chan">CHANCELLOR</span>`;
            if(p.hasVoted && !p.isDead && !p.isDisconnected) badges += `<span class="badge-tag voted">✓ VOTED</span>`;
            if(p.isDead) badges += `<span class="badge-tag" style="background:#000;">☠ DEAD</span>`;
            if(p.isDisconnected && !p.isDead) badges += `<span class="badge-tag offline">🔌 OFFLINE</span>`;
            
            if (p.revealedRole && !p.isDead) {
                if (p.revealedRole === 'Fascist') badges += `<span class="badge-tag team-fascist">FASCIST</span>`;
                if (p.revealedRole === 'Hitler') badges += `<span class="badge-tag team-hitler">HITLER</span>`;
            }
            
            if (p.investigatedParty && !p.isDead) {
                badges += `<span class="badge-tag intel-report">🔍 DETECTED: ${p.investigatedParty}</span>`;
            }
            
            row.innerHTML = `<span>${p.name} ${p.id === myId ? '<strong>(You)</strong>' : ''}</span> <div>${badges}</div>`;
            pList.appendChild(row);
        });

        renderControls(state);
    } 
    else if (state.status === 'FINISHED') {
        gameScreen.classList.add('hidden');
        endScreen.classList.remove('hidden');
        document.getElementById('victory-title').textContent = "MATCH CONCLUDED!";
        document.getElementById('victory-reason').textContent = state.winner;
    }
});

function updateChaosTracker(failCount) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.querySelector(`.chaos-dot-node[data-index="${i}"]`);
        if (dot) {
            if (i <= failCount) {
                dot.classList.add('active-tracker-point');
            } else {
                dot.classList.remove('active-tracker-point');
            }
        }
    }
}

function renderTrack(elementId, score, totalSlots, type, totalPlayers) {
    const track = document.getElementById(elementId);
    track.innerHTML = '';
    
    for(let i = 1; i <= totalSlots; i++) {
        const slot = document.createElement('div');
        const isFilled = i <= score;
        slot.className = `slot ${isFilled ? 'filled-' + type : ''}`;
        
        if (isFilled) {
            slot.textContent = '★';
        } else {
            if (type === 'Fascist') {
                if (totalPlayers === 5 || totalPlayers === 6) {
                    if (i === 3) { slot.classList.add('power-peek'); slot.textContent = '👁'; }
                    else if (i === 4 || i === 5) { slot.classList.add('power-execution'); slot.textContent = '☠'; }
                    else slot.textContent = i;
                } 
                else if (totalPlayers === 7 || totalPlayers === 8) {
                    if (i === 2) { slot.classList.add('power-investigate'); slot.textContent = '🔍'; }
                    else if (i === 3) { slot.classList.add('power-election'); slot.textContent = '🗳'; }
                    else if (i === 4 || i === 5) { slot.classList.add('power-execution'); slot.textContent = '☠'; }
                    else slot.textContent = i;
                } 
                else {
                    if (i === 1 || i === 2) { slot.classList.add('power-investigate'); slot.textContent = '🔍'; }
                    else if (i === 3) { slot.classList.add('power-election'); slot.textContent = '🗳'; }
                    else if (i === 4 || i === 5) { slot.classList.add('power-execution'); slot.textContent = '☠'; }
                    else slot.textContent = i;
                }
            } else {
                slot.textContent = i;
            }
        }
        track.appendChild(slot);
    }
}

function renderControls(state) {
    const ctrl = document.getElementById('interactive-controls');
    const prompt = document.getElementById('action-prompt');
    ctrl.innerHTML = '';
    
    const amIPresident = state.players.find(p => p.id === myId)?.isPresident;
    const amIChancellor = state.players.find(p => p.id === myId)?.isChancellor;

    const myPlayerObj = state.players.find(p => p.id === myId);
    if (myPlayerObj && myPlayerObj.isDisconnected) {
        prompt.textContent = "Attempting link restoration connection sync diagnostics...";
        return;
    }

    if (state.phase === 'NOMINATION' && amIPresident) {
        prompt.textContent = "You are the President! Choose a living player to nominate as Chancellor:";
        state.players.forEach(p => {
            if (p.id !== myId && !p.isDead && !p.isDisconnected && p.isEligibleChancellor) {
                const btn = document.createElement('button');
                btn.className = "btn wood-btn secondary animate-pop";
                btn.textContent = p.name;
                btn.onclick = () => socket.emit('nominateChancellor', { roomCode: currentRoomCode, chancellorId: p.id });
                ctrl.appendChild(btn);
            }
        });
    } 
    else if (state.phase === 'VOTING') {
        if(myPlayerObj && myPlayerObj.isDead) {
            prompt.textContent = "You are deceased. You cannot cast votes on proposed governments.";
            return;
        }
        prompt.textContent = `Cast your Government Vote: Chancellor Nominee is ${state.currentNominee}`;
        ['Ja', 'Nein'].forEach(v => {
            const btn = document.createElement('button');
            btn.className = v === 'Ja' ? "btn success-btn animate-pop" : "btn wood-btn primary animate-pop";
            btn.textContent = v;
            btn.onclick = () => socket.emit('castVote', { roomCode: currentRoomCode, vote: v === 'Ja' });
            ctrl.appendChild(btn);
        });
    } 
    else if (state.phase === 'LEGISLATIVE_PRESIDENT' && amIPresident) {
        prompt.textContent = "Presidential Action: Select ONE policy card to DISCARD into the discard pile:";
        state.drawnCards.forEach((card, idx) => {
            const div = document.createElement('div');
            div.className = `policy-card card-${card} animate-pop`;
            div.textContent = card;
            div.onclick = () => {
                const keep = [0,1,2].filter(i => i !== idx);
                socket.emit('presidentDiscard', { roomCode: currentRoomCode, keepIndex1: keep[0], keepIndex2: keep[1] });
            };
            ctrl.appendChild(div);
        });
    } 
    else if (state.phase === 'LEGISLATIVE_CHANCELLOR' && amIChancellor) {
        prompt.textContent = "Chancellor Action: Choose ONE card to ENACT into permanent law:";
        state.drawnCards.forEach((card, idx) => {
            const div = document.createElement('div');
            div.className = `policy-card card-${card} animate-pop`;
            div.textContent = card;
            div.onclick = () => socket.emit('chancellorEnact', { roomCode: currentRoomCode, enactIndex: idx });
            ctrl.appendChild(div);
        });
    } 
    else if (state.phase === 'PRESIDENTIAL_POWER_PEEK') {
        if (amIPresident) {
            prompt.textContent = "EXECUTIVE POWER (POLICY PEEK): Below are the top 3 upcoming cards from the Draw Deck:";
            state.drawnCards.forEach(card => {
                const div = document.createElement('div');
                div.className = `policy-card card-${card} animate-pop`;
                div.style.cursor = "default";
                div.textContent = card;
                ctrl.appendChild(div);
            });
            const closeBtn = document.createElement('button');
            closeBtn.className = "btn control-btn animate-pop";
            closeBtn.style.display = "block";
            closeBtn.style.margin = "15px auto 0";
            closeBtn.textContent = "End Policy Peek Turn";
            closeBtn.onclick = () => socket.emit('closePolicyPeek', currentRoomCode);
            ctrl.appendChild(closeBtn);
        } else {
            prompt.textContent = "The President is currently inspecting the upcoming cards via Policy Peek power...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_INVESTIGATE') {
        if (amIPresident) {
            prompt.textContent = "EXECUTIVE POWER TRIGGERED: Select a living player to investigate their Party Loyalty:";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.textContent = `Investigate ${p.name}`;
                    btn.onclick = () => socket.emit('investigateLoyalty', { roomCode: currentRoomCode, targetId: p.id });
                    ctrl.appendChild(btn);
                }
            });
        } else {
            prompt.textContent = "The President is currently using the Executive Power to investigate a player's loyalty...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_ELECTION') {
        if (amIPresident) {
            prompt.textContent = "EXECUTIVE POWER TRIGGERED: Select the next player to pass the Special Presidency to:";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.style.background = "linear-gradient(to bottom, #9c27b0, #6a1b9a)";
                    btn.textContent = `Appoint ${p.name}`;
                    btn.onclick = () => socket.emit('callSpecialElection', { roomCode: currentRoomCode, targetId: p.id });
                    ctrl.appendChild(btn);
                }
            });
        } else {
            prompt.textContent = "The President is appointing a candidate to hold a Special Election round...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_EXECUTION') {
        if (amIPresident) {
            prompt.textContent = "EXECUTIVE POWER TRIGGERED: Choose a player to EXECUTE. (If you kill Hitler, Liberals win!):";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn wood-btn primary animate-pop";
                    btn.style.boxShadow = "0 0 10px #ff3d00";
                    btn.textContent = `Execute ${p.name} ☠`;
                    btn.onclick = () => socket.emit('executeTargetPlayer', { roomCode: currentRoomCode, targetId: p.id });
                    ctrl.appendChild(btn);
                }
            });
        } else {
            prompt.textContent = "DANGER! The President is utilizing the Executive Power to execute a player...";
        }
    }
    else {
        prompt.textContent = `Waiting for players to resolve current actions...`;
    }
}