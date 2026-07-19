const socket = io();
let currentRoomCode = null, myId = null;

let recordedLiberalLaws = null;
let recordedFascistLaws = null;
let localRoleBriefingSeen = false;
let lastSavedState = null;

let currentLang = 'en';

const setupScreen = document.getElementById('setup-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const btnAddBot = document.getElementById('btn-add-bot');
const btnRemoveBot = document.getElementById('btn-remove-bot');
const btnStart = document.getElementById('btn-start');
const btnReturnLobby = document.getElementById('btn-return-lobby');
const chkBozbey = document.getElementById('chk-bozbey');
const langSelect = document.getElementById('lang-select');

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

const langPack = {
    en: {
        usernamePlace: "Enter Your Name",
        btnCreate: "Create New Lobby",
        btnJoin: "Join Existing Lobby",
        menuDivider: "OR",
        roomCodePlace: "4-Letter Code",
        lblLang: "🌐 Select Language / Dil Seçin:",
        lobbyCodeHeader: "LOBBY CODE",
        bozbeyRule: "Bozbey version 1.0",
        lobbyPlayersTitle: "Players in the Lobby:",
        btnAddBot: "Add AI Bot",
        btnRemoveBot: "Remove Bot",
        btnStart: "Start Match",
        statDraw: "DRAW",
        statChaos: "CHAOS",
        statDiscard: "DISCARD",
        boardLiberal: "LIBERAL POLICIES",
        boardFascist: "FASCIST POLICIES",
        seatingChartTitle: "Seating Chart & Live Registry",
        revealRibbon: "CLASSIFIED BRIEFING",
        revealTitle: "YOUR SECRET IDENTITY",
        revealInstructions: "Keep your identity hidden from the rest of the table.",
        btnContinueGame: "Continue to Game",
        actionRibbon: "ACTION REQUIRED",
        flashStamp: "LAW ENACTED",
        flashSubtext: "The country moves closer to its conclusion...",
        btnContinue: "Continue",
        btnReturnLobby: "Return to Lobby",
        badgePres: "PRESIDENT",
        badgeChan: "CHANCELLOR",
        badgeVoted: "✓ VOTED",
        badgeWaiting: "⏳ WAITING",
        badgeOffline: "🔌 OFFLINE",
        badgeDead: "☠ DECEASED",
        badgeYouSuffix: "(You)",
        roleLiberal: "LIBERAL",
        roleFascist: "FASCIST",
        roleHitler: "HITLER",
        roleBozbey: "BOZBEY",
        roleWord: "Role",
        phaseWord: "Phase",
        waitingTurnLoop: "Waiting for turn loop initialization...",
        yourTurnModalAlert: "Your turn! Please make a selection in the overlay popup window.",
        nominationPresidentPrompt: "You are the President! Choose a living player to nominate as Chancellor:",
        nominationPassivePrompt: "Nomination Phase: Waiting for {name} to propose a Chancellor...",
        votingChoicePrompt: "President {pres} nominated \"{chan}\" as Chancellor. Cast your Government Vote:",
        votingDeceasedPassive: "You are deceased. Watching the election process unfold...",
        voteRevealPassive: "ELECTION BALLOT SUMMARY: Revealing votes cast by all players...",
        legislativePresPrompt: "Presidential Legislative Action: Select a policy card to DISCARD into the graveyard:",
        legislativePresPassive: "Legislative Phase: The President is choosing a card to discard...",
        btnConfirmDiscard: "Confirm Discard Selection 🗑",
        legislativeChanPrompt: "Chancellor Legislative Action: Select a policy card to ENACT into permanent law:",
        legislativeChanPassive: "Legislative Phase: The Chancellor is selecting a card to enact into law...",
        btnConfirmEnact: "Confirm Enact Selection 📜",
        btnRequestVeto: "Call For Agenda Veto ✋",
        vetoRequestPrompt: "VETO CALL TRIGGERED: The Chancellor wishes to completely veto this legislative agenda. Do you agree to burn both drawn cards?",
        vetoRequestPassive: "Veto Procedure: {name} requested an agenda veto. Waiting for President's agreement response...",
        btnVetoAgree: "Agree (Burn Agenda)",
        btnVetoDeny: "Deny (Force Law)",
        powerPeekPrompt: "EXECUTIVE POWER (POLICY PEEK): Top 3 upcoming cards from the Draw Deck:",
        powerPeekPassive: "Executive Power: The President is inspecting the upcoming deck order...",
        btnEndPeek: "End Policy Peek Turn",
        powerInvestigatePrompt: "EXECUTIVE POWER: Select a living player to investigate their Party Loyalty:",
        powerInvestigatePassive: "Executive Power: The President is currently investigating a player's loyalty card...",
        powerElectionPrompt: "EXECUTIVE POWER: Select the next player to pass the Special Presidency to:",
        powerElectionPassive: "Executive Power: The President is appointing a candidate to a Special Election turn...",
        powerExecutionPrompt: "EXECUTIVE POWER: Choose a player to EXECUTE (Killing Hitler awards Liberals victory):",
        powerExecutionPassive: "🚨 CRITICAL THREAT: The President is selecting a player for execution!",
        victoryTitle: "MATCH CONCLUDED!",
        detectedParty: "🔍 PARTY:"
    },
    tr: {
        usernamePlace: "İsminizi Girin",
        btnCreate: "Yeni Lobi Oluştur",
        btnJoin: "Var Olan Lobiye Katıl",
        menuDivider: "VEYA",
        roomCodePlace: "4 Haneli Kod",
        lblLang: "🌐 Dil Seçin / Select Language:",
        lobbyCodeHeader: "LOBİ KODU",
        bozbeyRule: "Bozbey Sürümü 1.0",
        lobbyPlayersTitle: "Lobideki Oyuncular:",
        btnAddBot: "Yapay Zeka Botu Ekle",
        btnRemoveBot: "Bot Çıkar",
        btnStart: "Maçı Başlat",
        statDraw: "DESTE",
        statChaos: "KAOS",
        statDiscard: "ISKARTA",
        boardLiberal: "LİBERAL POLİTİKALAR",
        boardFascist: "FAŞİST POLİTİKALAR",
        seatingChartTitle: "Oturma Düzeni & Canlı Kayıt",
        revealRibbon: "GİZLİ BRİFİNG",
        revealTitle: "GİZLİ KİMLİĞİNİZ",
        revealInstructions: "Kimliğinizi masanın geri kalanından gizli tutun.",
        btnContinueGame: "Oyuna Devam Et",
        actionRibbon: "EYLEM GEREKLİ",
        flashStamp: "YASA YÜRÜRLÜKTE",
        flashSubtext: "Ülke kaçınılmaz sona doğru yaklaşıyor...",
        btnContinue: "Devam Et",
        btnReturnLobby: "Lobiye Dön",
        badgePres: "CUMHURBAŞKANI",
        badgeChan: "ŞANSÖLYE",
        badgeVoted: "✓ OYLADI",
        badgeWaiting: "⏳ BEKLİYOR",
        badgeOffline: "🔌 ÇEVRİMDİŞİ",
        badgeDead: "☠ ELENDİ",
        badgeYouSuffix: "(Sen)",
        roleLiberal: "LİBERAL",
        roleFascist: "FAŞİST",
        roleHitler: "HITLER",
        roleBozbey: "BOZBEY",
        roleWord: "Rol",
        phaseWord: "Evre",
        waitingTurnLoop: "Tur döngüsünün başlaması bekleniyor...",
        yourTurnModalAlert: "Senin sıran! Lütfen açılır pencereden bir seçim yap.",
        nominationPresidentPrompt: "Cumhurbaşkanısın! Şansölye olarak atamak için yaşayan bir oyuncu seç:",
        nominationPassivePrompt: "Adaylık Evresi: {name} isimli Cumhurbaşkanının Şansölye önermesi bekleniyor...",
        votingChoicePrompt: "Cumhurbaşkanı {pres}, \"{chan}\" oyuncusunu Şansölye adayı gösterdi. Hükümet için oy kullanın:",
        votingDeceasedPassive: "Öldün. Seçim sürecini izliyorsun...",
        voteRevealPassive: "SEÇİM SIRA ÖZETİ: Tüm oyuncuların kullandığı oylar açıklanıyor...",
        legislativePresPrompt: "Cumhurbaşkanı Yasama Eylemi: Mezarlığa ISKARTAYA ATMAK için bir politika kartı seç:",
        legislativePresPassive: "Yasama Evresi: Cumhurbaşkanı ıskartaya atılacak bir kart seçiyor...",
        btnConfirmDiscard: "Iskartayı Onayla 🗑",
        legislativeChanPrompt: "Şansölye Yasama Eylemi: Kalıcı yasa olarak YÜRÜRLÜĞE KOYMAK için bir politika kartı seç:",
        legislativeChanPassive: "Yasama Evresi: Şansölye yürürlüğe koymak için bir kart seçiyor...",
        btnConfirmEnact: "Yürürlüğü Onayla 📜",
        btnRequestVeto: "Gündem Vetosu Çağrısı Yap ✋",
        vetoRequestPrompt: "VETO ÇAĞRISI TETİKLENDİ: Şansölye bu yasama gündemini tamamen veto etmek istiyor. Çekilen iki kartı da yakmayı kabul ediyor musunuz?",
        vetoRequestPassive: "Veto Süreci: {name} gündem vetosu talep etti. Cumhurbaşkanının onay yanıtı bekleniyor...",
        btnVetoAgree: "Kabul Et (Gündemi Yak)",
        btnVetoDeny: "Reddet (Yasayı Zorla)",
        powerPeekPrompt: "YÜRÜTME GÜCÜ (POLİTİKA DİKİZLEME): Deste başındaki gelecek 3 kart:",
        powerPeekPassive: "Yürütme Gücü: Cumhurbaşkanı yaklaşan deste sırasını inceliyor...",
        btnEndPeek: "Politika Dikizleme Turunu Bitir",
        powerInvestigatePrompt: "YÜRÜTME GÜCÜ: Sadakatini araştırmak için yaşayan bir oyuncu seç:",
        powerInvestigatePassive: "Yürütme Gücü: Cumhurbaşkanı şu anda bir oyuncunun sadakat kartını araştırıyor...",
        powerElectionPrompt: "YÜRÜTME GÜCÜ: Özel Cumhurbaşkanlığını devretmek için bir sonraki oyuncuyu seç:",
        powerElectionPassive: "Yürütme Gücü: Cumhurbaşkanı Özel Seçim turu için bir aday atıyor...",
        powerExecutionPrompt: "YÜRÜTME GÜCÜ: İDAM ETMEK için bir oyuncu seç (Hitler'i öldürmek Liberallere zafer kazandırır):",
        powerExecutionPassive: "🚨 KRİTİK TEHDİT: Cumhurbaşkanı idam için bir oyuncu seçiyor!",
        victoryTitle: "MAÇ SONUÇLANDI!",
        detectedParty: "🔍 PARTİ:"
    }
};

// Requirement: Wrapped securely in element checking closures to protect initial listener pipelines
function updateStaticTranslations() {
    const pack = langPack[currentLang];
    
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const setPlaceholder = (id, txt) => { const el = document.getElementById(id); if (el) el.placeholder = txt; };

    setPlaceholder('username', pack.usernamePlace);
    setTxt('btn-create', pack.btnCreate);
    setTxt('btn-join', pack.btnJoin);
    setTxt('txt-menu-divider', pack.menuDivider);
    setPlaceholder('room-code', pack.roomCodePlace);
    setTxt('lbl-lang-choice', pack.lblLang);
    
    setTxt('lbl-lobby-code-header', pack.lobbyCodeHeader);
    const chkText = document.querySelector('#lobby-screen .custom-chk-text');
    if (chkText) chkText.textContent = pack.bozbeyRule;
    
    setTxt('lbl-lobby-players-title', pack.lobbyPlayersTitle);
    setTxt('btn-add-bot', pack.btnAddBot);
    setTxt('btn-remove-bot', pack.btnRemoveBot);
    setTxt('btn-start', pack.btnStart);
    
    setTxt('lbl-stat-draw', pack.statDraw);
    setTxt('lbl-stat-chaos', pack.statChaos);
    setTxt('lbl-stat-discard', pack.statDiscard);
    
    setTxt('lbl-board-liberal-title', pack.boardLiberal);
    setTxt('lbl-board-fascist-title', pack.boardFascist);
    setTxt('lbl-seating-chart-title', pack.seatingChartTitle);
    
    setTxt('lbl-reveal-ribbon', pack.revealRibbon);
    setTxt('lbl-reveal-title', pack.revealTitle);
    setTxt('reveal-card-instructions', pack.revealInstructions);
    setTxt('btn-close-role-reveal', pack.btnContinueGame);
    
    setTxt('lbl-action-ribbon', pack.actionRibbon);
    setTxt('lbl-flash-stamp', pack.flashStamp);
    setTxt('lbl-flash-subtext', pack.flashSubtext);
    setTxt('btn-close-policy-flash', pack.btnContinue);
    setTxt('btn-return-lobby', pack.btnReturnLobby);
    
    if (lastSavedState) {
        socket.emit('castVote', { roomCode: null, dummy: true }); 
    }
}

langSelect.onchange = () => {
    currentLang = langSelect.value;
    updateStaticTranslations();
};

function getLocalizedRole(roleName) {
    if (!roleName) return "";
    const pack = langPack[currentLang];
    if (roleName.toUpperCase() === 'LIBERAL') return pack.roleLiberal;
    if (roleName.toUpperCase() === 'FASCIST') return pack.roleFascist;
    if (roleName.toUpperCase() === 'HITLER') return pack.roleHitler;
    if (roleName.toUpperCase() === 'BOZBEY') return pack.roleBozbey;
    return roleName;
}

function getLocalizedParty(partyName) {
    if (!partyName) return "";
    const pack = langPack[currentLang];
    if (partyName.toUpperCase() === 'LIBERAL') return pack.roleLiberal;
    if (partyName.toUpperCase() === 'FASCIST') return pack.roleFascist;
    return partyName;
}

function syncRoomCodeText(code) {
    document.querySelectorAll('.display-code-global').forEach(el => {
        el.textContent = code;
    });
}

socket.on('roomCreated', (code) => {
    currentRoomCode = code;
    syncRoomCodeText(code);
    setupScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
});

socket.on('gameStateUpdate', (state) => {
    if (state.roomCode === null) return;
    
    currentRoomCode = state.roomCode;
    lastSavedState = state; 
    syncRoomCodeText(state.roomCode); 
    
    const pack = langPack[currentLang];
    
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
            revealCardVisual.textContent = getLocalizedRole(state.yourRole);
            roleRevealOverlay.className = "modal-overlay animate-fade";
        }

        const badge = document.getElementById('role-badge');
        badge.textContent = `${pack.roleWord}: ${getLocalizedRole(state.yourRole)}`;
        if (state.yourRole === 'Bozbey') badge.style.color = '#e040fb'; 
        else badge.style.color = state.yourRole === 'Liberal' ? '#2196f3' : '#f44336';

        document.getElementById('current-phase-text').textContent = `${pack.phaseWord}: ${state.phase.replace(/_/g, ' ')}`;
        
        renderTrack('liberal-slots-track', state.liberalPolicies, 5, 'Liberal', state.players.length);
        renderTrack('fascist-slots-track', state.fascistPolicies, 6, 'Fascist', state.players.length);
        
        const pList = document.getElementById('game-players-list');
        pList.innerHTML = '';
        state.players.forEach(p => {
            const card = document.createElement('div');
            card.className = `player-card ${p.isDead ? 'dead-player' : ''} ${p.isDisconnected ? 'disconnected-player' : ''} ${(p.isPresident || p.isChancellor) ? 'active-gov' : ''}`;
            
            const nameSpan = document.createElement('div');
            nameSpan.className = 'player-card-name';
            nameSpan.innerHTML = `${p.name} ${p.id === myId ? `<strong style="color:#ffca28;">${pack.badgeYouSuffix}</strong>` : ''}`;
            card.appendChild(nameSpan);

            const badgesContainer = document.createElement('div');
            badgesContainer.className = 'player-card-badges-container';

            if(p.isPresident) badgesContainer.innerHTML += `<span class="badge-tag pres">${pack.badgePres}</span>`;
            if(p.isChancellor) badgesContainer.innerHTML += `<span class="badge-tag chan">${pack.badgeChan}</span>`;
            
            if (state.phase === 'VOTING' && !p.isDead && !p.isDisconnected) {
                if (!p.hasVoted) {
                    badgesContainer.innerHTML += `<span class="badge-tag waiting-vote">${pack.badgeWaiting}</span>`;
                } else if (state.phase !== 'VOTE_REVEAL') {
                    badgesContainer.innerHTML += `<span class="badge-tag voted">${pack.badgeVoted}</span>`;
                }
            } else if (p.hasVoted && state.phase !== 'VOTE_REVEAL' && !p.isDead && !p.isDisconnected) {
                badgesContainer.innerHTML += `<span class="badge-tag voted">${pack.badgeVoted}</span>`;
            }

            if(p.isDisconnected && !p.isDead) badgesContainer.innerHTML += `<span class="badge-tag offline">${pack.badgeOffline}</span>`;
            if(p.isDead) badgesContainer.innerHTML += `<span class="badge-tag" style="background:#000; color:#fff;">${pack.badgeDead}</span>`;

            if (p.revealedRole && !p.isDead) {
                const roleTag = document.createElement('div');
                roleTag.className = `player-card-role-block role-block-${p.revealedRole.toLowerCase()}`;
                roleTag.textContent = getLocalizedRole(p.revealedRole);
                badgesContainer.appendChild(roleTag);
            }
            
            if (p.investigatedParty && !p.isDead) {
                badgesContainer.innerHTML += `<span class="badge-tag intel-report">${pack.detectedParty} ${getLocalizedParty(p.investigatedParty)}</span>`;
            }
            card.appendChild(badgesContainer);

            if (state.phase === 'VOTE_REVEAL' && p.voteValue !== undefined && p.voteValue !== null) {
                const stamp = document.createElement('div');
                stamp.className = p.voteValue === true ? 'card-live-ballot-stamp stamp-ja' : 'card-live-ballot-stamp stamp-nein';
                stamp.textContent = p.voteValue === true ? (currentLang === 'tr' ? 'EVET' : 'JA!') : (currentLang === 'tr' ? 'HAYIR' : 'NEIN');
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

        document.getElementById('victory-title').textContent = pack.victoryTitle;
        document.getElementById('victory-reason').textContent = state.winner;
    }
});

function triggerFlashOverlayAnimation(factionType) {
    const pack = langPack[currentLang];
    policyAnimationOverlay.className = `full-screen-flash-overlay flash-${factionType.toLowerCase()}-theme`;
    flashPolicyTitle.textContent = factionType === 'Liberal' ? pack.boardLiberal : pack.boardFascist;
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
    
    const pack = langPack[currentLang];
    
    if (!localRoleBriefingSeen) {
        actionModalOverlay.classList.add('hidden');
        return;
    }

    const amIPresident = state.players.find(p => p.id === myId)?.isPresident;
    const amIChancellor = state.players.find(p => p.id === myId)?.isChancellor;
    const myPlayerObj = state.players.find(p => p.id === myId);

    let isMyActionTurn = false;
    let fallbackStatusText = pack.waitingTurnLoop;

    if (myPlayerObj && myPlayerObj.isDisconnected) {
        passivePromptText.textContent = "Restoration Sync...";
        actionModalOverlay.classList.add('hidden');
        return;
    }

    if (state.phase === 'NOMINATION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.nominationPresidentPrompt;
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
            fallbackStatusText = pack.nominationPassivePrompt.replace('{name}', currentPresName);
        }
    } 
    else if (state.phase === 'VOTING') {
        if(myPlayerObj && myPlayerObj.isDead) {
            fallbackStatusText = pack.votingDeceasedPassive;
        } else {
            isMyActionTurn = true;
            const currentPresObj = state.players.find(p => p.isPresident);
            const currentPresName = currentPresObj ? currentPresObj.name : "President";
            
            prompt.textContent = pack.votingChoicePrompt.replace('{pres}', currentPresName).replace('{chan}', state.currentNominee);
            
            [(currentLang === 'tr' ? 'Evet' : 'Ja'), (currentLang === 'tr' ? 'Hayır' : 'Nein')].forEach((v, idx) => {
                const btn = document.createElement('button');
                btn.className = idx === 0 ? "btn success-btn animate-pop" : "btn wood-btn primary animate-pop";
                btn.textContent = v;
                btn.onclick = () => {
                    socket.emit('castVote', { roomCode: currentRoomCode, vote: idx === 0 });
                    actionModalOverlay.classList.add('hidden');
                };
                ctrl.appendChild(btn);
            });
        }
    } 
    else if (state.phase === 'VOTE_REVEAL') {
        fallbackStatusText = pack.voteRevealPassive;
    }
    else if (state.phase === 'LEGISLATIVE_PRESIDENT') {
        if (amIPresident) {
            isMyActionTurn = true;
            let chosenCardIndex = null;
            
            const drawPresidentialCardInterface = () => {
                ctrl.innerHTML = '';
                prompt.textContent = pack.legislativePresPrompt;
                
                state.drawnCards.forEach((card, idx) => {
                    const div = document.createElement('div');
                    div.className = `policy-card card-${card} animate-pop ${chosenCardIndex === idx ? 'selected-target-card' : ''}`;
                    div.textContent = getLocalizedParty(card);
                    
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
                    confirmBtn.textContent = pack.btnConfirmDiscard;
                    
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
            fallbackStatusText = pack.legislativePresPassive;
        }
    } 
    else if (state.phase === 'LEGISLATIVE_CHANCELLOR') {
        if (amIChancellor) {
            isMyActionTurn = true;
            let chosenCardIndex = null;

            const drawChancellorCardInterface = () => {
                ctrl.innerHTML = '';
                prompt.textContent = pack.legislativeChanPrompt;
                
                state.drawnCards.forEach((card, idx) => {
                    const div = document.createElement('div');
                    div.className = `policy-card card-${card} animate-pop ${chosenCardIndex === idx ? 'selected-target-card' : ''}`;
                    div.textContent = getLocalizedParty(card);
                    
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
                    confirmBtn.textContent = pack.btnConfirmEnact;
                    
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
                    vetoBtn.textContent = pack.btnRequestVeto;
                    vetoBtn.onclick = () => {
                        socket.emit('requestVeto', currentRoomCode);
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(vetoBtn);
                }
            };
            drawChancellorCardInterface();
        } else {
            fallbackStatusText = pack.legislativeChanPassive;
        }
    } 
    else if (state.phase === 'VETO_REQUEST') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.vetoRequestPrompt;
            
            const acceptBtn = document.createElement('button');
            acceptBtn.className = "btn success-btn animate-pop";
            acceptBtn.textContent = pack.btnVetoAgree;
            acceptBtn.onclick = () => {
                socket.emit('respondToVeto', { roomCode: currentRoomCode, accept: true });
                actionModalOverlay.classList.add('hidden');
            };

            const denyBtn = document.createElement('button');
            denyBtn.className = "btn wood-btn primary animate-pop";
            denyBtn.textContent = pack.btnVetoDeny;
            denyBtn.onclick = () => {
                socket.emit('respondToVeto', { roomCode: currentRoomCode, accept: false });
                actionModalOverlay.classList.add('hidden');
            };

            ctrl.appendChild(acceptBtn);
            ctrl.appendChild(denyBtn);
        } else {
            const currentChanName = state.players.find(p => p.isChancellor)?.name || "Chancellor";
            fallbackStatusText = pack.vetoRequestPassive.replace('{name}', currentChanName);
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_PEEK') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.powerPeekPrompt;
            state.drawnCards.forEach(card => {
                const div = document.createElement('div');
                div.className = `policy-card card-${card} animate-pop`;
                div.style.cursor = "default";
                div.textContent = getLocalizedParty(card);
                ctrl.appendChild(div);
            });
            const closeBtn = document.createElement('button');
            closeBtn.className = "btn control-btn animate-pop";
            closeBtn.style.display = "block";
            closeBtn.style.margin = "15px auto 0";
            closeBtn.textContent = pack.btnEndPeek;
            closeBtn.onclick = () => {
                socket.emit('closePolicyPeek', currentRoomCode);
                actionModalOverlay.classList.add('hidden');
            };
            ctrl.appendChild(closeBtn);
        } else {
            fallbackStatusText = pack.powerPeekPassive;
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_INVESTIGATE') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.powerInvestigatePrompt;
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.textContent = `${currentLang === 'tr' ? 'Araştır:' : 'Investigate'} ${p.name}`;
                    btn.onclick = () => {
                        socket.emit('investigateLoyalty', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = pack.powerInvestigatePassive;
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_ELECTION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.powerElectionPrompt;
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn control-btn animate-pop";
                    btn.style.background = "linear-gradient(to bottom, #9c27b0, #6a1b9a)";
                    btn.textContent = `${currentLang === 'tr' ? 'Ata:' : 'Appoint'} ${p.name}`;
                    btn.onclick = () => {
                        socket.emit('callSpecialElection', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = pack.powerElectionPassive;
        }
    }
    else if (state.phase === 'PRESIDENTIAL_POWER_EXECUTION') {
        if (amIPresident) {
            isMyActionTurn = true;
            prompt.textContent = pack.powerExecutionPrompt;
            state.players.forEach(p => {
                if (p.id !== myId && !p.isDead && !p.isDisconnected) {
                    const btn = document.createElement('button');
                    btn.className = "btn wood-btn primary animate-pop";
                    btn.style.boxShadow = "0 0 10px #ff3d00";
                    btn.textContent = `${currentLang === 'tr' ? 'İdam Et:' : 'Execute'} ${p.name} ☠`;
                    btn.onclick = () => {
                        socket.emit('executeTargetPlayer', { roomCode: currentRoomCode, targetId: p.id });
                        actionModalOverlay.classList.add('hidden');
                    };
                    ctrl.appendChild(btn);
                }
            });
        } else {
            fallbackStatusText = pack.powerExecutionPassive;
        }
    }

    if (isMyActionTurn) {
        actionModalOverlay.classList.remove('hidden');
        passivePromptText.textContent = pack.yourTurnModalAlert;
    } else {
        actionModalOverlay.classList.add('hidden');
        passivePromptText.textContent = fallbackStatusText;
    }
}