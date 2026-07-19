const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const botNames = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta", "Bot Epsilon"];

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createDeck() {
    const deck = [];
    for (let i = 0; i < 6; i++) deck.push('Liberal');
    for (let i = 0; i < 11; i++) deck.push('Fascist');
    return shuffle(deck);
}

function assignRoles(room) {
    const players = room.players;
    const count = players.length;
    let roles = [];
    
    if (count === 5 || count === 6) {
        roles.push('Hitler', 'Fascist');
        const liberalsNeeded = count - 2;
        for (let i = 0; i < liberalsNeeded; i++) roles.push('Liberal');
    } else if (count === 7 || count === 8) {
        roles.push('Hitler', 'Fascist', 'Fascist');
        const liberalsNeeded = count - 3;
        for (let i = 0; i < liberalsNeeded; i++) roles.push('Liberal');
    } else { 
        roles.push('Hitler', 'Fascist', 'Fascist', 'Fascist');
        const liberalsNeeded = count - 4;
        for (let i = 0; i < liberalsNeeded; i++) roles.push('Liberal');
    }
    
    shuffle(roles);

    if (room.bozbeyMode) {
        const liberalIndex = roles.indexOf('Liberal');
        if (liberalIndex !== -1) {
            roles[liberalIndex] = 'Bozbey';
        }
    }
    
    players.forEach((player, idx) => { 
        player.role = roles[idx]; 
        player.isDead = false; 
        player.isDisconnected = false;
    });
}

function getSanitizedState(room, playerId) {
    const player = room.players.find(p => p.id === playerId);
    const count = room.players.length;
    const livingCount = room.players.filter(p => !p.isDead).length;
    
    const currentHostPlayer = room.players.find(p => !p.isBot);

    return {
        roomCode: room.code,
        status: room.status,
        bozbeyMode: room.bozbeyMode,
        amIHost: currentHostPlayer && currentHostPlayer.id === playerId, 
        players: room.players.map(p => {
            let roleToReveal = null;
            
            if (player) {
                if (player.role === 'Fascist' && (p.role === 'Fascist' || p.role === 'Hitler')) {
                    roleToReveal = p.role;
                }
                if (player.role === 'Hitler' && count <= 6 && (p.role === 'Fascist' || p.role === 'Hitler')) {
                    roleToReveal = p.role;
                }
                if (p.id === playerId) {
                    roleToReveal = p.role;
                }
            }

            let eligibleChancellor = true;
            if (p.id === room.lastElectedChancellorId) eligibleChancellor = false;
            if (livingCount > 5 && p.id === room.lastElectedPresidentId) eligibleChancellor = false;

            let trackedParty = null;
            if (player && room.investigations && room.investigations[player.name] && room.investigations[player.name][p.name]) {
                trackedParty = room.investigations[player.name][p.name];
            }

            return {
                id: p.id,
                name: p.name,
                isPresident: room.players[room.presidentIdx]?.id === p.id,
                isChancellor: room.players[room.chancellorIdx]?.id === p.id,
                hasVoted: room.votes[p.id] !== undefined,
                voteValue: room.phase === 'VOTE_REVEAL' ? room.votes[p.id] : null, 
                isDead: p.isDead,
                isDisconnected: p.isDisconnected,
                isEligibleChancellor: eligibleChancellor,
                revealedRole: roleToReveal,
                investigatedParty: trackedParty
            };
        }),
        yourRole: player ? player.role : null,
        liberalPolicies: room.liberalPolicies,
        fascistPolicies: room.fascistPolicies,
        electionTracker: room.electionTracker,
        phase: room.phase,
        currentNominee: room.chancellorIdx !== null ? room.players[room.chancellorIdx].name : null,
        drawnCards: (room.phase === 'LEGISLATIVE_PRESIDENT' && room.players[room.presidentIdx]?.id === playerId) ? room.drawnCards :
                    (room.phase === 'LEGISLATIVE_CHANCELLOR' && room.players[room.chancellorIdx]?.id === playerId) ? room.drawnCards :
                    (room.phase === 'PRESIDENTIAL_POWER_PEEK' && room.players[room.presidentIdx]?.id === playerId) ? room.deck.slice(-3).reverse() : [],
        winner: room.winner,
        deckCount: room.deck.length,
        discardCount: room.discardPile.length
    };
}

function broadcastState(roomCode) {
    const room = rooms[roomCode.toUpperCase()];
    if (!room) return;
    room.players.forEach(player => {
        if (!player.isBot && !player.isDisconnected) {
            io.to(player.id).emit('gameStateUpdate', getSanitizedState(room, player.id));
        }
    });
    triggerBotActions(roomCode);
}

function advanceTurn(room) {
    if (room.specialPresidentActive) {
        room.specialPresidentActive = false;
        room.presidentIdx = room.lastRegularPresidentIdx;
    }
    
    do {
        room.presidentIdx = (room.presidentIdx + 1) % room.players.length;
    // Requirement 2: Dynamically skip disconnected players during selection
    } while (room.players[room.presidentIdx].isDead || room.players[room.presidentIdx].isDisconnected);
    
    room.lastRegularPresidentIdx = room.presidentIdx;
    room.chancellorIdx = null;
    room.phase = 'NOMINATION';
    room.drawnCards = [];
}

function triggerBotActions(roomCode) {
    const room = rooms[roomCode.toUpperCase()];
    if (!room || room.status !== 'IN_PROGRESS') return;

    setTimeout(() => {
        const currentPresident = room.players[room.presidentIdx];
        const currentChancellor = room.chancellorIdx !== null ? room.players[room.chancellorIdx] : null;

        if (room.phase === 'NOMINATION' && currentPresident?.isBot) {
            const livingCount = room.players.filter(p => !p.isDead).length;
            const eligible = room.players.filter(p => {
                if (p.id === currentPresident.id || p.isDead || p.isDisconnected) return false;
                if (p.id === room.lastElectedChancellorId) return false;
                if (livingCount > 5 && p.id === room.lastElectedPresidentId) return false;
                return true;
            });

            let target = eligible[Math.floor(Math.random() * eligible.length)];
            if(target) {
                room.chancellorIdx = room.players.findIndex(p => p.id === target.id);
                room.phase = 'VOTING';
                room.votes = {};
                broadcastState(roomCode);
            }
        }

        if (room.phase === 'VOTING') {
            let voteMade = false;
            room.players.forEach(p => {
                if (p.isBot && !p.isDead && room.votes[p.id] === undefined) {
                    room.votes[p.id] = p.role === 'Liberal' ? Math.random() > 0.3 : Math.random() > 0.15;
                    voteMade = true;
                }
            });
            if (voteMade) evaluateVotes(roomCode);
        }

        if (room.phase === 'LEGISLATIVE_PRESIDENT' && currentPresident?.isBot) {
            let discardIndex = currentPresident.role === 'Liberal' ? 
                room.drawnCards.findIndex(c => c === 'Fascist') : room.drawnCards.findIndex(c => c === 'Liberal');
            if (discardIndex === -1) discardIndex = 0;
            
            const keep = [0, 1, 2].filter(i => i !== discardIndex);
            room.discardPile.push(room.drawnCards[discardIndex]);
            room.drawnCards = [room.drawnCards[keep[0]], room.drawnCards[keep[1]]];
            room.phase = 'LEGISLATIVE_CHANCELLOR';
            broadcastState(roomCode);
        }

        if (room.phase === 'LEGISLATIVE_CHANCELLOR' && currentChancellor?.isBot) {
            if (room.fascistPolicies === 5 && currentChancellor.role === 'Liberal' && !room.drawnCards.includes('Liberal')) {
                room.phase = 'VETO_REQUEST';
                broadcastState(roomCode);
                return;
            }

            let enactIndex = currentChancellor.role === 'Liberal' ? 
                room.drawnCards.findIndex(c => c === 'Liberal') : room.drawnCards.findIndex(c => c === 'Fascist');
            if (enactIndex === -1) enactIndex = 0;
            executeEnact(roomCode, enactIndex);
        }

        if (room.phase === 'VETO_REQUEST' && currentPresident?.isBot) {
            const accept = currentPresident.role === 'Liberal' || !room.drawnCards.includes('Fascist');
            executeVetoResolution(room, accept);
            broadcastState(roomCode);
        }

        if (room.phase === 'PRESIDENTIAL_POWER_PEEK' && currentPresident?.isBot) {
            advanceTurn(room);
            broadcastState(roomCode);
        }

        if (room.phase === 'PRESIDENTIAL_POWER_INVESTIGATE' && currentPresident?.isBot) {
            advanceTurn(room);
            broadcastState(roomCode);
        }

        if (room.phase === 'PRESIDENTIAL_POWER_ELECTION' && currentPresident?.isBot) {
            const targets = room.players.filter(p => p.id !== currentPresident.id && !p.isDead && !p.isDisconnected);
            if(targets.length > 0) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                room.specialPresidentActive = true;
                room.presidentIdx = room.players.findIndex(p => p.id === target.id);
                room.chancellorIdx = null;
                room.phase = 'NOMINATION';
            } else {
                advanceTurn(room);
            }
            broadcastState(roomCode);
        }

        if (room.phase === 'PRESIDENTIAL_POWER_EXECUTION' && currentPresident?.isBot) {
            const targets = room.players.filter(p => p.id !== currentPresident.id && !p.isDead && !p.isDisconnected);
            if (targets.length > 0) {
                const victim = targets[Math.floor(Math.random() * targets.length)];
                victim.isDead = true;
                
                if (victim.role === 'Bozbey') {
                    room.status = 'FINISHED';
                    room.winner = `Bozbey (${victim.name} manipulated the table to get executed and won!)`;
                } else if (victim.role === 'Hitler') {
                    room.status = 'FINISHED';
                    room.winner = 'Liberals (Hitler was executed!)';
                } else {
                    advanceTurn(room);
                }
            } else {
                advanceTurn(room);
            }
            broadcastState(roomCode);
        }
    }, 1500);
}

function checkAndReplenishDeck(room) {
    if (room.deck.length < 3) {
        const shuffledDiscard = shuffle(room.discardPile);
        room.deck = shuffledDiscard.concat(room.deck);
        room.discardPile = [];
    }
}

function executeVetoResolution(room, accept) {
    if (accept) {
        room.discardPile.push(room.drawnCards[0]);
        room.discardPile.push(room.drawnCards[1]);
        room.drawnCards = [];
        room.electionTracker += 1;

        if (room.electionTracker >= 3) {
            if (room.deck.length < 1) {
                const shuffledDiscard = shuffle(room.discardPile);
                room.deck = shuffledDiscard.concat(room.deck);
                room.discardPile = [];
            }
            const topPolicy = room.deck.pop();
            if (topPolicy === 'Liberal') room.liberalPolicies++;
            else room.fascistPolicies++;
            room.electionTracker = 0;
            room.lastElectedPresidentId = null;
            room.lastElectedChancellorId = null;

            if (room.liberalPolicies >= 5) { room.status = 'FINISHED'; room.winner = 'Liberals'; }
            else if (room.fascistPolicies >= 6) { room.status = 'FINISHED'; room.winner = 'Fascists'; }
        }
        advanceTurn(room);
    } else {
        room.phase = 'LEGISLATIVE_CHANCELLOR'; 
    }
}

function evaluateVotes(roomCode) {
    const room = rooms[roomCode.toUpperCase()];
    const activeVoters = room.players.filter(p => !p.isDead && !p.isDisconnected);
    if (Object.keys(room.votes).length !== activeVoters.length) return;

    room.phase = 'VOTE_REVEAL';
    broadcastState(roomCode);

    setTimeout(() => {
        const currentRoom = rooms[roomCode.toUpperCase()];
        if (!currentRoom) return;

        const jaCount = Object.values(currentRoom.votes).filter(v => v === true).length;
        if (jaCount > activeVoters.length / 2) {
            if (currentRoom.players[currentRoom.chancellorIdx].role === 'Hitler' && currentRoom.fascistPolicies >= 3) {
                currentRoom.status = 'FINISHED';
                currentRoom.winner = 'Fascists (Hitler elected Chancellor)';
                broadcastState(roomCode);
                return;
            }

            currentRoom.lastElectedPresidentId = currentRoom.players[currentRoom.presidentIdx].id;
            currentRoom.lastElectedChancellorId = currentRoom.players[currentRoom.chancellorIdx].id;

            currentRoom.phase = 'LEGISLATIVE_PRESIDENT';
            checkAndReplenishDeck(currentRoom);
            currentRoom.drawnCards = [currentRoom.deck.pop(), currentRoom.deck.pop(), currentRoom.deck.pop()];
            currentRoom.electionTracker = 0;
        } else {
            currentRoom.electionTracker += 1;
            currentRoom.chancellorIdx = null;
            if (currentRoom.electionTracker >= 3) {
                if (currentRoom.deck.length < 1) {
                    const shuffledDiscard = shuffle(currentRoom.discardPile);
                    currentRoom.deck = shuffledDiscard.concat(currentRoom.deck);
                    currentRoom.discardPile = [];
                }
                const topPolicy = currentRoom.deck.pop();
                if (topPolicy === 'Liberal') currentRoom.liberalPolicies++;
                else currentRoom.fascistPolicies++;
                currentRoom.electionTracker = 0;
                currentRoom.lastElectedPresidentId = null;
                currentRoom.lastElectedChancellorId = null;
            }
            advanceTurn(currentRoom);
        }
        currentRoom.votes = {}; 
        broadcastState(roomCode);
    }, 2000);
}

function executeEnact(roomCode, enactIndex) {
    const room = rooms[roomCode.toUpperCase()];
    const count = room.players.length;
    const enacted = room.drawnCards[enactIndex];
    room.discardPile.push(room.drawnCards[enactIndex === 0 ? 1 : 0]);

    if (enacted === 'Liberal') room.liberalPolicies++;
    else room.fascistPolicies++;

    if (room.liberalPolicies >= 5) { 
        room.status = 'FINISHED'; 
        room.winner = 'Liberals'; 
    } else if (room.fascistPolicies >= 6) { 
        room.status = 'FINISHED'; 
        room.winner = 'Fascists'; 
    } else {
        if (enacted === 'Fascist') {
            const fp = room.fascistPolicies;
            checkAndReplenishDeck(room);
            
            if (count === 5 || count === 6) {
                if (fp === 3) { room.phase = 'PRESIDENTIAL_POWER_PEEK'; broadcastState(roomCode); return; }
            } 
            else if (count === 7 || count === 8) {
                if (fp === 2) { room.phase = 'PRESIDENTIAL_POWER_INVESTIGATE'; broadcastState(roomCode); return; }
                if (fp === 3) { room.phase = 'PRESIDENTIAL_POWER_ELECTION'; broadcastState(roomCode); return; }
            } 
            else if (count === 9 || count === 10) {
                if (fp === 1 || fp === 2) { room.phase = 'PRESIDENTIAL_POWER_INVESTIGATE'; broadcastState(roomCode); return; }
                if (fp === 3) { room.phase = 'PRESIDENTIAL_POWER_ELECTION'; broadcastState(roomCode); return; }
            }

            if (fp === 4 || fp === 5) {
                room.phase = 'PRESIDENTIAL_POWER_EXECUTION';
                room.drawnCards = [];
                broadcastState(roomCode);
                return;
            }
        }
        advanceTurn(room);
    }
    room.drawnCards = [];
    broadcastState(roomCode);
}

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        // Requirement 5: Restrict user name lengths on back-end initialization hooks
        const cleanName = typeof playerName === 'string' ? playerName.trim().substring(0, 12) : "Player";
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            code: roomCode, 
            status: 'LOBBY',
            hostId: socket.id, 
            players: [{ id: socket.id, name: cleanName, role: null, isBot: false, isDead: false, isDisconnected: false }],
            deck: [], discardPile: [], presidentIdx: 0, lastRegularPresidentIdx: 0, chancellorIdx: null,
            liberalPolicies: 0, fascistPolicies: 0, electionTracker: 0,
            phase: 'SETUP', votes: {}, drawnCards: [], winner: null, specialPresidentActive: false,
            lastElectedPresidentId: null, lastElectedChancellorId: null, investigations: {}, bozbeyMode: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        broadcastState(roomCode);
    });

    socket.on('toggleBozbeyMode', ({ roomCode, enabled }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        const dynamicHost = room ? room.players.find(p => !p.isBot) : null;
        if (room && room.status === 'LOBBY' && dynamicHost && socket.id === dynamicHost.id) {
            room.bozbeyMode = enabled;
            broadcastState(roomCode);
        }
    });

    socket.on('addBot', (roomCode) => {
        if (!roomCode) return;
        const code = roomCode.toUpperCase();
        const room = rooms[code];
        if (!room) return socket.emit('errorMsg', 'Lobby not found.');
        
        const dynamicHost = room.players.find(p => !p.isBot);
        if (!dynamicHost || socket.id !== dynamicHost.id) {
            return socket.emit('errorMsg', 'Action denied. Only the lobby host can add AI bots.');
        }
        if (room.status !== 'LOBBY') return;
        if (room.players.length >= 10) return;

        const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
        const name = botNames[room.players.filter(p => p.isBot).length] || `Bot ${room.players.length + 1}`;
        room.players.push({ id: botId, name: name, role: null, isBot: true, isDead: false, isDisconnected: false });
        broadcastState(code);
    });

    socket.on('removeBot', (roomCode) => {
        if (!roomCode) return;
        const code = roomCode.toUpperCase();
        const room = rooms[code];
        if (!room) return;

        const dynamicHost = room.players.find(p => !p.isBot);
        if (!dynamicHost || socket.id !== dynamicHost.id) return;
        if (room.status !== 'LOBBY') return;

        const lastBotIdx = room.players.map(p => p.isBot).lastIndexOf(true);
        if (lastBotIdx !== -1) {
            room.players.splice(lastBotIdx, 1);
            broadcastState(code);
        }
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        if (!roomCode) return;
        const code = roomCode.toUpperCase();
        const room = rooms[code];
        if (!room) return socket.emit('errorMsg', 'Lobby not found.');

        // Requirement 5: Limit incoming payload length
        const cleanName = typeof playerName === 'string' ? playerName.trim().substring(0, 12) : "Player";

        const existingPlayer = room.players.find(p => p.name === cleanName);
        if (room.status === 'IN_PROGRESS' && existingPlayer && existingPlayer.isDisconnected) {
            existingPlayer.id = socket.id; 
            existingPlayer.isDisconnected = false;
            socket.join(code);
            broadcastState(code);
            return;
        }

        if (room.status !== 'LOBBY' || room.players.length >= 10) {
            return socket.emit('errorMsg', 'Cannot join lobby.');
        }
        
        room.players.push({ id: socket.id, name: cleanName, role: null, isBot: false, isDead: false, isDisconnected: false });
        socket.join(code);
        broadcastState(code);
    });

    socket.on('startGame', (roomCode) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        const dynamicHost = room ? room.players.find(p => !p.isBot) : null;
        if (!room || !dynamicHost || socket.id !== dynamicHost.id) return;
        if (room.players.length < 5) return socket.emit('errorMsg', 'Minimum 5 players required.');
        room.players = shuffle(room.players);
        room.status = 'IN_PROGRESS';
        room.phase = 'NOMINATION';
        assignRoles(room);
        room.deck = createDeck();
        room.presidentIdx = 0; 
        room.lastRegularPresidentIdx = 0;
        broadcastState(roomCode);
    });

    socket.on('nominateChancellor', ({ roomCode, chancellorId }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'NOMINATION' || socket.id === chancellorId) return;
        
        const livingCount = room.players.filter(p => !p.isDead).length;
        if (chancellorId === room.lastElectedChancellorId) return socket.emit('errorMsg', 'Restricted by term limits.');
        if (livingCount > 5 && chancellorId === room.lastElectedPresidentId) return socket.emit('errorMsg', 'Restricted by term limits.');

        room.chancellorIdx = room.players.findIndex(p => p.id === chancellorId);
        room.phase = 'VOTING';
        room.votes = {};
        broadcastState(roomCode);
    });

    socket.on('castVote', ({ roomCode, vote }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'VOTING') return;
        room.votes[socket.id] = vote;
        evaluateVotes(roomCode);
    });

    socket.on('requestVeto', (roomCode) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'LEGISLATIVE_CHANCELLOR') return;
        if (room.players[room.chancellorIdx].id !== socket.id) return;
        if (room.fascistPolicies !== 5) return;

        room.phase = 'VETO_REQUEST';
        broadcastState(roomCode);
    });

    socket.on('respondToVeto', ({ roomCode, accept }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'VETO_REQUEST') return;
        if (room.players[room.presidentIdx].id !== socket.id) return;

        executeVetoResolution(room, accept);
        broadcastState(roomCode);
    });

    socket.on('presidentDiscard', ({ roomCode, keepIndex1, keepIndex2 }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'LEGISLATIVE_PRESIDENT') return;
        const c1 = room.drawnCards[keepIndex1];
        const c2 = room.drawnCards[keepIndex2];
        room.drawnCards.forEach((c, idx) => {
            if (idx !== keepIndex1 && idx !== keepIndex2) room.discardPile.push(c);
        });
        room.drawnCards = [c1, c2];
        room.phase = 'LEGISLATIVE_CHANCELLOR';
        broadcastState(roomCode);
    });

    socket.on('chancellorEnact', ({ roomCode, enactIndex }) => {
        if (!roomCode) return;
        if (!rooms[roomCode.toUpperCase()] || rooms[roomCode.toUpperCase()].phase !== 'LEGISLATIVE_CHANCELLOR') return;
        executeEnact(roomCode, enactIndex);
    });

    socket.on('closePolicyPeek', (roomCode) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'PRESIDENTIAL_POWER_PEEK') return;
        advanceTurn(room);
        broadcastState(roomCode);
    });

    socket.on('investigateLoyalty', ({ roomCode, targetId }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'PRESIDENTIAL_POWER_INVESTIGATE') return;
        const investigator = room.players.find(p => p.id === socket.id);
        const target = room.players.find(p => p.id === targetId);
        if (investigator && target) {
            const party = (target.role === 'Fascist' || target.role === 'Hitler') ? 'FASCIST' : 'LIBERAL';
            if (!room.investigations[investigator.name]) room.investigations[investigator.name] = {};
            room.investigations[investigator.name][target.name] = party;
            socket.emit('investigationLoyaltyResult', { name: target.name, party: party });
            advanceTurn(room);
            broadcastState(roomCode);
        }
    });

    socket.on('callSpecialElection', ({ roomCode, targetId }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'PRESIDENTIAL_POWER_ELECTION') return;
        const targetIdx = room.players.findIndex(p => p.id === targetId);
        if (targetIdx !== -1 && !room.players[targetIdx].isDead) {
            room.specialPresidentActive = true;
            room.presidentIdx = targetIdx;
            room.chancellorIdx = null;
            room.phase = 'NOMINATION';
            broadcastState(roomCode);
        }
    });

    socket.on('executeTargetPlayer', ({ roomCode, targetId }) => {
        if (!roomCode) return;
        const room = rooms[roomCode.toUpperCase()];
        if (!room || room.phase !== 'PRESIDENTIAL_POWER_EXECUTION') return;
        const target = room.players.find(p => p.id === targetId);
        if (target && !target.isDead) {
            target.isDead = true;
            if (target.role === 'Bozbey') {
                room.status = 'FINISHED';
                room.winner = `Bozbey (${target.name} won!)`;
            } else if (target.role === 'Hitler') {
                room.status = 'FINISHED';
                room.winner = 'Liberals (Hitler was executed!)';
            } else {
                advanceTurn(room);
            }
            broadcastState(roomCode);
        }
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            const room = rooms[code];
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                if (room.status === 'LOBBY') {
                    room.players.splice(idx, 1);
                    const nextHumanHost = room.players.find(p => !p.isBot);
                    if (nextHumanHost) room.hostId = nextHumanHost.id; 
                    else delete rooms[code]; 
                } else {
                    room.players[idx].isDisconnected = true;
                    
                    // Requirement 2: Automated Pass processing triggers to protect rooms against player drop-offs
                    const currentPresident = room.players[room.presidentIdx];
                    const currentChancellor = room.chancellorIdx !== null ? room.players[room.chancellorIdx] : null;

                    if (room.phase === 'VOTING') {
                        evaluateVotes(code);
                    } else if (room.phase === 'NOMINATION' && currentPresident && currentPresident.id === socket.id) {
                        advanceTurn(room);
                    } else if (room.phase === 'LEGISLATIVE_PRESIDENT' && currentPresident && currentPresident.id === socket.id) {
                        advanceTurn(room);
                    } else if (room.phase === 'LEGISLATIVE_CHANCELLOR' && currentChancellor && currentChancellor.id === socket.id) {
                        advanceTurn(room);
                    } else if (room.phase === 'VETO_REQUEST' && ((currentPresident && currentPresident.id === socket.id) || (currentChancellor && currentChancellor.id === socket.id))) {
                        advanceTurn(room);
                    } else if (room.phase.startsWith('PRESIDENTIAL_POWER_') && currentPresident && currentPresident.id === socket.id) {
                        advanceTurn(room);
                    }
                }
                broadcastState(code);
                break;
            }
        }
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Server running safely'));