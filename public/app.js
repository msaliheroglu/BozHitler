const socket = io();
let currentRoomCode = null, myId = null;

let recordedLiberalLaws = null;
let recordedFascistLaws = null;
let localRoleBriefingSeen = false;
let lastSavedState = null;

const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const btnAddBot = document.getElementById('btn-add-bot');
const btnRemoveBot = document.getElementById('btn-remove-bot');
const btnStart = document.getElementById('btn-start');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const chkBozbey = document.getElementById('chk-bozbey');

const actionModalOverlay = document.getElementById('action-modal-overlay');
const passivePromptText = document.getElementById('passive-prompt-text');

const roleRevealOverlay = document.getElementById('role-reveal-overlay');
const revealCardVisual = document.getElementById('reveal-card-visual');
const btnCloseRoleReveal = document.getElementById('btn-close-role-reveal');

const policyAnimationOverlay = document.getElementById('policy-animation-overlay');
const flashPolicyTitle = document.getElementById('flash-policy-title');
const btnClosePolicyFlash = document.getElementById('btn-close-policy-flash');

socket.on('connect', () => { myId = socket.id; });
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

btnRemoveBot.onclick = () => {
    if(currentRoomCode) socket.emit('removeBot', currentRoomCode);
};

btnReturnLobby.onclick = () => {
    if(currentRoomCode) socket.emit('returnToLobby', currentRoomCode);
};

chkBozbey.onchange = () => {
    if (currentRoomCode) {
        socket.emit('toggleBozbeyMode', { roomCode: currentRoomCode, enabled: chkBozbey.checked });
    }
};

roleRevealOverlay.onclick = (e) => {
    if (e.target === roleRevealOverlay) e.stopPropagation();
};

actionModalOverlay.onclick = (e) => {
    if (e.target === actionModalOverlay) e.stopPropagation();
};

policyAnimationOverlay.onclick = (e) => {
    if (e.target === policyAnimationOverlay) e.stopPropagation();
};

btnCloseRoleReveal.onclick = () => {
    localRoleBriefingSeen = true;
    roleRevealOverlay.classList.add('hidden');
    if (lastSavedState) {
        renderControls(lastSavedState); 
    }
};

btnClosePolicyFlash.onclick = () => {
    policyAnimationOverlay.classList.add('hidden');
};

function syncRoomCodeText(code) {
    document.querySelectorAll('.display-code-global').forEach(el => {
        el.textContent = code;
    });
}

socket.on('gameStateUpdate', (state) => {
    currentRoomCode = state.roomCode;
    lastSavedState = state; 
    syncRoomCodeText(state.roomCode); 
    
    if (state.status === 'LOBBY') {
        localRoleBriefingSeen = false;
        recordedLiberalLaws = null;
        recordedFascistLaws = null;

        setupScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        endScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        document.getElementById('lobby-count').textContent = state.players.length;
        
        chkBozbey.checked = state.bozbeyMode;
        const botCount = state.players.filter(p => p.id.startsWith('bot_')).length;

        if (state.amIHost) {
            btnStart.classList.remove('hidden');
            btnAddBot.classList.remove('hidden');
            chkBozbey.disabled = false;
            if (botCount > 0) btnRemoveBot.classList.remove('hidden');
            else btnRemoveBot.classList.add('hidden');
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
        setupScreen.classList.add('hidden'); 
        lobbyScreen.classList.add('hidden');
        endScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        document.getElementById('deck-count').textContent = state.deckCount;
        document.getElementById('discard-count').textContent = state.discardCount;

        updateChaosTracker(state.electionTracker);

        if (recordedLiberalLaws !== null && state.liberalPolicies > recordedLiberalLaws) {
            triggerFlashOverlayAnimation('Liberal');
        }
        if (recordedFascistLaws !== null && state.fascistPolicies > recordedFascistLaws) {
            triggerFlashOverlayAnimation('Fascist');
        }
        recordedLiberalLaws = state.liberalPolicies;
        recordedFascistLaws = state.fascistPolicies;

        if (!localRoleBriefingSeen && state.yourRole) {
            revealCardVisual.className = `reveal-identity-banner identity-${state.yourRole}`;
            revealCardVisual.textContent = state.yourRole.toUpperCase();
            roleRevealOverlay.classList.remove('hidden');
        }

        const badge = document.getElementById('role-badge');
        badge.textContent = `Secret Role: ${state.yourRole}`;
        if (state.yourRole === 'Bozbey') badge.style.color = '#e040fb'; 
        else badge.style.color = state.yourRole === 'Liberal' ? '#2196f3' : '#f44336';

        document.getElementById('current-phase-text').textContent = `PHASE: ${state.phase.replace(/_/g, ' ')}`;
        
        renderTrack('liberal-slots-track', state.liberalPolicies, 5, 'Liberal', state.players.length);
        renderTrack('fascist-slots-track', state.fascistPolicies, 6, 'Fascist', state.players.length);

        const pList = document.getElementById('game-players-list');
        pList.innerHTML = '';
        state.players.forEach(p => {
            const card = document.createElement('div');
            card.className = `player-card ${p.isDead ? 'dead-player' : ''} ${p.isDisconnected ? 'disconnected-player' : ''} ${(p.isPresident || p.isChancellor) ? 'active-gov' : ''}`;
            
            const nameSpan = document.createElement('div');
            nameSpan.className = 'player-card-name';
            nameSpan.innerHTML = `${p.name} ${p.id === myId ? '<strong style="color:#ffca28;">(You)</strong>' : ''}`;
            card.appendChild(nameSpan);

            const badgesContainer = document.createElement('div');
            badgesContainer.className = 'player-card-badges-container';

            if(p.isPresident) badgesContainer.innerHTML += `<span class="badge-tag pres">PRESIDENT</span>`;
            if(p.isChancellor) badgesContainer.innerHTML += `<span class="badge-tag chan">CHANCELLOR</span>`;
            
            // Fixed Bug Condition: Shows waiting label immediately to reveal who hasn't voted yet
            if (state.phase === 'VOTING' && !p.hasVoted && !p.isDead && !p.isDisconnected) {
                badgesContainer.innerHTML += `<span class="badge-tag waiting-vote">⏳ WAITING</span>`;
            } else if(p.hasVoted && state.phase !== 'VOTE_REVEAL' && !p.isDead && !p.isDisconnected) {
                badgesContainer.innerHTML += `<span class="badge-tag voted">✓ VOTED</span>`;
            }

            if(p.isDisconnected && !p.isDead) badgesContainer.innerHTML += `<span class="badge-tag offline">🔌 OFFLINE</span>`;
            if(p.isDead) badgesContainer.innerHTML += `<span class="badge-tag" style="background:#000; color:#fff;">☠ DECEASED</span>`;

            if (p.revealedRole && !p.isDead) {
                const roleTag = document.createElement('div');
                roleTag.className = `player-card-role-block role-block-${p.revealedRole.toLowerCase()}`;
                roleTag.textContent = p.revealedRole.toUpperCase();
                badgesContainer.appendChild(roleTag);
            }
            
            if (p.investigatedParty && !p.isDead) {
                badgesContainer.innerHTML += `<span class="badge-tag intel-report">🔍 PARTY: ${p.investigatedParty}</span>`;
            }
            card.appendChild(badgesContainer);

            if (state.phase === 'VOTE_REVEAL' && p.voteValue !== undefined && p.voteValue !== null) {
                const stamp = document.createElement('div');
                if (p.voteValue === true) {
                    stamp.className = 'card-live-ballot-stamp stamp-ja';
                    stamp.textContent = 'JA!';
                } else {
                    stamp.className = 'card-live-ballot-stamp stamp-nein';
                    stamp.textContent = 'NEIN';
                }
                card.appendChild(stamp);
            }
            
            pList.appendChild(card);
        });

        renderControls(state);
    } 
    else if (state.status === 'FINISHED') {
        actionModalOverlay.classList.add('hidden'); 
        gameScreen.classList.add('hidden');
        endScreen.classList.remove('hidden');
        
        if (state.amIHost) btnReturnLobby.classList.remove('hidden');
        else btnReturnLobby.classList.add('hidden');

        document.getElementById('victory-title').textContent = "MATCH CONCLUDED!";
        document.getElementById('victory-reason').textContent = state.winner;
    }
});

function triggerFlashOverlayAnimation(factionType) {
    policyAnimationOverlay.className = `full-screen-flash-overlay flash-${factionType.toLowerCase()}-theme`;
    flashPolicyTitle.textContent = `${factionType.toUpperCase()} POLICY`;
    policyAnimationOverlay.classList.remove('hidden');
}

function updateChaosTracker(failCount) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.querySelector(`.mini-dot[data-index="${i}"]`);
        if (dot) {
            if (i <= failCount) dot.classList.add('active-tracker-point');
            else dot.classList.remove('active-tracker-point');
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
    
    if (!localRoleBriefingSeen) {
        actionModalOverlay.classList.add('hidden');
        return;
    }

    const amIPresident = state.players.find(p => p.id === myId)?.isPresident;
    const amIChancellor = state.players.find(p => p.id === myId)?.isChancellor;
    const myPlayerObj = state.players.find(p => p.id === myId);

    let isMyActionTurn = false;
    let fallbackStatusText = "Waiting for other players to resolve current actions...";

    if (myPlayerObj && myPlayerObj.isDisconnected) {
        passivePromptText.textContent = "Attempting link restoration diagnostics...";
        actionModalOverlay.classList.add('hidden');
        return;
    }

    if (state.phase === 'NOMINATION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "You are the President! Choose a living player to nominate as Chancellor:";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected && p.isEligibleChancellor) {
                    const btn = document.createElement('button');
                    btn.className = "btn wood-btn secondary animate-pop";
                    btn.textContent = p.name;
                    btn.onclick = () => {
                        socket.emit('nominateChancellor', { roomCode: currentRoomCode, chancellorId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            const currentPresName = state.players.find(p => p.isPresident)?.name || "President";
            fallbackStatusText = `Nomination Phase: Waiting for ${currentPresName} to propose a Chancellor...`;
        }
    } 
    else if (state.phase === 'VOTING') {
        if(myPlayerObj && myPlayerObj.isDead) {
            fallbackStatusText = "You are deceased. Watching the election process unfold...";
        } else {
            isMyActionTurn = true;
            const currentPresObj = state.players.find(p => p.isPresident);
            const currentPresName = currentPresObj ? currentPresObj.name : "The President";
            
            prompt.textContent = `President ${currentPresName} nominated "${state.currentNominee}" as Chancellor. Cast your Government Vote:`;
            
            ['Ja', 'Nein'].forEach(v => {
                const btn = document.createElement('button');
                btn.className = v === 'Ja' ? "btn success-btn animate-pop" : "btn wood-btn primary animate-pop";
                btn.textContent = v;
                btn.onclick = () => {
                    socket.emit('castVote', { roomCode: currentRoomCode, vote: v === 'Ja' });
                    actionModalOverlay.classList.add('hidden');
                };
                ctrl.appendChild(btn);
            });
        }
    } 
    else if (state.phase === 'VOTE_REVEAL') {
        fallbackStatusText = "ELECTION BALLOT SUMMARY: Revealing votes cast by all players...";
    }
    else if (state.phase === 'LEGISLATIVE_PRESIDENT') {
        if (amIPresident) {
            isMyActionTurn = true;
            let chosenCardIndex = null;
            
            const drawPresidentialCardInterface = () => {
                ctrl.innerHTML = '';
                prompt.textContent = "Presidential Legislative Action: Select a policy card to DISCARD into the graveyard:";
                
                state.drawnCards.forEach((card, idx) => {
                    const div = document.createElement('div');
                    div.className = `policy-card card-${card} animate-pop ${chosenCardIndex === idx ? 'selected-target-card' : ''}`;
                    div.textContent = card;
                    
                    div.onclick = () => {
                        chosenCardIndex = idx;
                        drawPresidentialCardInterface(); 
                    };
                    ctrl.appendChild(div);
                });

                if (chosenCardIndex !== null) {
                    const confirmRow = document.createElement('div');
                    confirmRow.style.width = "100%";
                    confirmRow.style.marginTop = "15px";
                    
                    const confirmBtn = document.createElement('button');
                    confirmBtn.className = "btn wood-btn primary animate-pop";
                    confirmBtn.style.width = "100%";
                    confirmBtn.textContent = `Confirm Discard Selection 🗑`;
                    
                    confirmBtn.onclick = () => {
                        const keep = [0, 1, 2].filter(i => i !== chosenCardIndex);
                        socket.emit('presidentDiscard', { roomCode: currentRoomCode, keepIndex1: keep[0], keepIndex2: keep[1] });
                        actionModalOverlay.classList.add('hidden');
                    };
                    confirmRow.appendChild(confirmBtn);
                    ctrl.appendChild(confirmRow);
                }
            };
            drawPresidentialCardInterface();
        } else {
            fallbackStatusText = "Legislative Phase: The President is choosing a card to discard...";
        }
    } 
    else if (state.phase === 'LEGISLATIVE_CHANCELLOR') {
        if (amIChancellor) {
            isMyActionTurn = true;
            let chosenCardIndex = null;

            const drawChancellorCardInterface = () => {
                ctrl.innerHTML = '';
                prompt.textContent = "Chancellor Legislative Action: Select a policy card to ENACT into constitutional law:";
                
                state.drawnCards.forEach((card, idx) => {
                    const div = document.createElement('div');
                    div.className = `policy-card card-${card} animate-pop ${chosenCardIndex === idx ? 'selected-target-card' : ''}`;
                    div.textContent = card;
                    
                    div.onclick = () => {
                        chosenCardIndex = idx;
                        drawChancellorCardInterface();
                    };
                    ctrl.appendChild(div);
                });

                if (chosenCardIndex !== null) {
                    const confirmRow = document.createElement('div');
                    confirmRow.style.width = "100%";
                    confirmRow.style.marginTop = "15px";
                    
                    const confirmBtn = document.createElement('button');
                    confirmBtn.className = "btn success-btn animate-pop";
                    confirmBtn.style.width = "100%";
                    confirmBtn.textContent = `Confirm Enact Selection 📜`;
                    
                    confirmBtn.onclick = () => {
                        socket.emit('chancellorEnact', { roomCode: currentRoomCode, enactIndex: chosenCardIndex });
                        actionModalOverlay.classList.add('hidden');
                    };
                    confirmRow.appendChild(confirmBtn);
                    ctrl.appendChild(confirmRow);
                }

                if (state.fascistPolicies === 5) {
                    const vetoBtn = document.createElement('button');
                    vetoBtn.className = "btn control-btn animate-pop";
                    vetoBtn.style.background = "linear-gradient(to bottom, #ff3d00, #c62828)";
                    vetoBtn.style.display = "block";
                    vetoBtn.style.margin = "15px auto 0";
                    vetoBtn.textContent = "Call For Agenda Veto ✋";
                    vetoBtn.onclick = () => {
                        socket.emit('requestVeto', currentRoomCode);
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(vetoBtn);
                }
            };
            drawChancellorCardInterface();
        } else {
            fallbackStatusText = "Legislative Phase: The Chancellor is selecting a card to enact into law...";
        }
    } 
    else if (state.phase === 'VETO_REQUEST') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "VETO CALL TRIGGERED: The Chancellor wishes to completely veto this legislative agenda. Do you agree to burn both drawn cards?";
            
            const acceptBtn = document.createElement('button');
            acceptBtn.className = "btn success-btn animate-pop";
            acceptBtn.textContent = "Agree (Burn Agenda)";
            acceptBtn.onclick = () => {
                socket.emit('respondToVeto', { roomCode: currentRoomCode, accept: true });
                actionModalOverlay.classList.add('hidden');
            };

            const denyBtn = document.createElement('button');
            denyBtn.className = "btn wood-btn primary animate-pop";
            denyBtn.textContent = "Deny (Force Law)";
            denyBtn.onclick = () => {
                socket.emit('respondToVeto', { roomCode: currentRoomCode, accept: false });
                actionModalOverlay.classList.add('hidden');
            };

            ctrl.appendChild(acceptBtn);
            ctrl.appendChild(denyBtn);
        } else {
            const currentChanName = state.players.find(p => p.isChancellor)?.name || "Chancellor";
            fallbackStatusText = `Veto Procedure: ${currentChanName} requested an agenda veto. Waiting for President's agreement response...`;
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_PEEK') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "EXECUTIVE POWER (POLICY PEEK): Top 3 upcoming cards from the Draw Deck:";
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
            closeBtn.onclick = () => {
                socket.emit('closePolicyPeek', currentRoomCode);
                actionModalOverlay.classList.add('hidden');
            };
            ctrl.appendChild(closeBtn);
        } else {
            fallbackStatusText = "Executive Power: The President is inspecting the upcoming deck order...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_INVESTIGATE') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "EXECUTIVE POWER: Select a living player to investigate their Party Loyalty:";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.textContent = `Investigate ${p.name}`;
                    btn.onclick = () => {
                        socket.emit('investigateLoyalty', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = "Executive Power: The President is currently investigating a player's loyalty card...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_ELECTION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "EXECUTIVE POWER: Select the next player to pass the Special Presidency to:";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.style.background = "linear-gradient(to bottom, #9c27b0, #6a1b9a)";
                    btn.textContent = `Appoint ${p.name}`;
                    btn.onclick = () => {
                        socket.emit('callSpecialElection', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = "Executive Power: The President is appointing a candidate to a Special Election turn...";
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_EXECUTION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = "EXECUTIVE POWER: Choose a player to EXECUTE (Killing Hitler awards Liberals victory):";
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn wood-btn primary animate-pop";
                    btn.style.boxShadow = "0 0 10px #ff3d00";
                    btn.textContent = `Execute ${p.name} ☠`;
                    btn.onclick = () => {
                        socket.emit('executeTargetPlayer', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = "🚨 CRITICAL THREAT: The President is selecting a player for execution!";
        }
    }

    if (isMyActionTurn) {
        actionModalOverlay.classList.remove('hidden');
        passivePromptText.textContent = "Your turn! Please make a selection in the overlay popup window.";
    } else {
        actionModalOverlay.classList.add('hidden');
        passivePromptText.textContent = fallbackStatusText;
    }
}