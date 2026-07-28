window.Synth = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playNote(freq, type, duration, vol=0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    play(effect) {
        this.init();
        switch(effect) {
            case 'start':
                this.playNote(440, 'square', 0.1);
                setTimeout(() => this.playNote(554, 'square', 0.1), 100);
                setTimeout(() => this.playNote(659, 'square', 0.3), 200);
                break;
            case 'move':
                this.playNote(600, 'sine', 0.1);
                break;
            case 'roll':
                for(let i=0; i<4; i++) {
                    setTimeout(() => this.playNote(150 + Math.random()*100, 'triangle', 0.05), i*60);
                }
                break;
            case 'correct':
                this.playNote(523.25, 'sine', 0.15);
                setTimeout(() => this.playNote(659.25, 'sine', 0.15), 150);
                setTimeout(() => this.playNote(783.99, 'sine', 0.3), 300);
                break;
            case 'wrong':
                this.playNote(300, 'sawtooth', 0.2);
                setTimeout(() => this.playNote(250, 'sawtooth', 0.3), 150);
                break;
            case 'win':
                [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99].forEach((freq, i) => {
                    setTimeout(() => this.playNote(freq, 'square', i===6?0.6:0.15), i*150);
                });
                break;
        }
    }
};

window.players = [];
window.currentPlayer = 0;
window.isMoving = false;
window.landOwnership = {};
window.lastPlayerPos = 0;

const PLAYER_COLORS = [
    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', name: '빨강' },
    { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', name: '파랑' },
    { bg: '#dcfce7', border: '#10b981', text: '#166534', name: '초록' },
    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', name: '노랑' }
];

const AVAILABLE_ANIMALS = ['🐶 강아지', '🐱 고양이', '🐰 토끼', '🦁 사자', '🐼 판다', '🦊 여우', '🐯 호랑이', '🐵 원숭이'];

/* ===== 🎲 이벤트 칸 무작위 뽑기 리스트 ===== */
const RANDOM_EVENTS = [
    { title: "🎁 대박 행운!", desc: "춘천의 따뜻한 인심을 만나 지역 상품권을 선물받았습니다!\n(+150점 획득)", score: 150, move: 0 },
    { title: "🚀 바람을 가르는 스피드!", desc: "지름길을 발견하여 신나게 달려갑니다!\n(앞으로 2칸 전진)", score: 0, move: 2 },
    { title: "🍗 맛있는 음식 탐방", desc: "춘천의 명물 음식을 맛있게 먹고 힘이 납니다!\n(+80점 획득)", score: 80, move: 0 },
    { title: "💸 지갑을 잃어버릴 뻔!", desc: "기념품을 사느라 예산을 생각보다 많이 썼습니다.\n(-50점 감점)", score: -50, move: 0 },
    { title: "🌀 앗, 길을 착각했다!", desc: "풍경에 눈이 팔려 길을 잘못 들어섰습니다.\n(뒤로 2칸 후퇴)", score: 0, move: -2 },
    { title: "☔ 갑작스러운 소나기", desc: "갑자기 비가 내려 근처 쉼터에서 비를 피합니다.\n(다음 1턴 쉬어가기)", score: 0, move: 0, skip: 1 }
];

/* ===== 구글 시트 읽기 전용 연동 세팅 ===== */
window.boardData = []; 
const webAppUrl = "https://script.google.com/macros/s/AKfycbwAJ2Q-W21AVUkh4-ydZ9w7PckFLTxLMpHUvME6WJNUB8aJgtUev7leiYiCiTrB3FBcjA/exec";

// 1. 게임 시작 시 구글 시트에서 데이터 불러오기 (읽기 전용)
async function loadBoardDataFromSheet() {
    try {
        const response = await fetch(webAppUrl);
        const sheetData = await response.json();
        if (sheetData && sheetData.length > 0) {
            window.boardData = sheetData;
            console.log("구글 시트 데이터 로드 성공!");
        }
    } catch (error) {
        console.error("구글 시트 데이터 로드 실패", error);
        alert("보드판 데이터를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.");
    }
}

// 창이 열릴 때 데이터 로드 후 닉네임 필드 세팅
window.addEventListener('DOMContentLoaded', async () => {
    await loadBoardDataFromSheet();
    window.updateNicknameFields();
});

window.handleSpecialSpace = function (cell) {
    const p = window.players[window.currentPlayer];
    
    if (cell.id === 7) { 
        alert(`🚡 ${cell.name}\n\n${cell.desc}`);
        window.skipPlayers[window.currentPlayer] = 1;
        window.rolledDouble = false;
        window.nextTurn();
        return;
    } else if (cell.id === 14) {
        p.score += 100;
        window.updateTokens();
        alert(`🎉 ${cell.name}\n\n${cell.desc}`);
        if (window.checkWinCondition()) return;
        window.nextTurn();
        return;
    } else if (cell.id === 21) {
        p.pos = 0;
        window.updateTokens();
        alert(`🚣 ${cell.name}\n\n${cell.desc}`);
        window.nextTurn();
        return;
    }

    if ([4, 10, 17, 24].includes(cell.id)) {
        const randomIndex = Math.floor(Math.random() * RANDOM_EVENTS.length);
        const event = RANDOM_EVENTS[randomIndex];

        alert(`🎲 [${cell.name} - 랜덤 이벤트]\n\n${event.title}\n${event.desc}`);

        if (event.score !== 0) {
            p.score += event.score;
            if (p.score < 0) p.score = 0; 
        }

        if (event.skip) {
            window.skipPlayers[window.currentPlayer] = event.skip;
            window.rolledDouble = false;
        }

        window.updateTokens();
        if (window.checkWinCondition()) return;

        if (event.move !== 0) {
            window.movePlayer(event.move);
        } else {
            window.nextTurn();
        }
    }
};

window.skipPlayers = {}; 

window.updateNicknameFields = function () {
    const selectEl = document.getElementById('playerCountSelect');
    if (!selectEl) return;
    
    const count = parseInt(selectEl.value) || 2;
    const container = document.getElementById('nicknameFieldsContainer');
    if(!container) return;
    
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.style.background = '#fff';
        div.style.padding = '8px';
        div.style.borderRadius = '8px';
        div.style.border = `2px solid ${PLAYER_COLORS[i].border}`;

        let optionsHtml = '';
        AVAILABLE_ANIMALS.forEach((animal, idx) => {
            const selected = (idx === i) ? 'selected' : '';
            optionsHtml += `<option value="${animal.split(' ')[0]}" ${selected}>${animal}</option>`;
        });

        div.innerHTML = `
            <label style="font-weight:600; font-size:13px; margin-bottom:4px; display:block; color:${PLAYER_COLORS[i].text};">
                ${PLAYER_COLORS[i].name} 플레이어 ${i + 1} 캐릭터 & 닉네임
            </label>
            <div style="display: flex; gap: 6px;">
                <select class="animal-select" data-index="${i}" style="padding:6px; border:2px solid #e2e8f0; border-radius:6px; font-size:14px; background:#f8fafc;">
                    ${optionsHtml}
                </select>
                <input type="text" class="nickname-input" data-index="${i}" placeholder="플레이어 ${i + 1}" maxlength="10" style="flex:1; padding:6px; border:2px solid #e2e8f0; border-radius:6px; font-size:14px; text-align:center;">
            </div>
        `;
        container.appendChild(div);
    }
};

window.landUpgrades = {}; 
window.isUpgradeAttempt = false; 

window.initLocalGame = async function () {
    if (!window.boardData || window.boardData.length === 0) {
        alert('보드판 데이터를 불러오는 중입니다. 잠시만 기다려주세요.');
        await loadBoardDataFromSheet();
        return;
    }

    const inputs = document.querySelectorAll('.nickname-input');
    const selects = document.querySelectorAll('.animal-select');
    
    if (inputs.length === 0) {
        alert('플레이어 정보를 입력해주세요.');
        return;
    }

    const tempPlayers = [];

    inputs.forEach((input, idx) => {
        let name = input.value.trim();
        if (!name) name = `플레이어 ${idx + 1}`;
        const animalIcon = selects[idx] ? selects[idx].value : '🐶';

        tempPlayers.push({
            pos: 0,
            score: 200,
            cards: 0,
            name: name,
            animal: animalIcon,
            colorIndex: idx,
            colorBg: PLAYER_COLORS[idx].bg,
            colorBorder: PLAYER_COLORS[idx].border
        });
    });

    window.players = tempPlayers;
    window.currentPlayer = 0;
    window.landOwnership = {};
    window.landUpgrades = {}; 
    window.skipPlayers = {};
    window.rolledDouble = false;

    window.gameMode = document.querySelector('input[name="gameMode"]:checked').value;

    if (window.gameMode === 'time') {
        window.timeLeft = (parseInt(document.getElementById('timeLimitInput').value) || 10) * 60;
        window.startTimer();
    } else {
        window.totalTurns = parseInt(document.getElementById('turnLimitInput').value) || 20;
        window.currentTurnCount = 1;
    }

    document.getElementById('startScreen').classList.add('hidden');
    
    window.createBoard();
    window.updateTokens();
    window.updateTurnUI();

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) rollBtn.disabled = false;

    window.Synth.play('start');
};

window.createBoard = function () {
    const grid = document.getElementById('boardGrid');
    const existingCells = grid.querySelectorAll('.board-cell');
    existingCells.forEach(cell => cell.remove());

    window.boardData.forEach(cell => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'board-cell';
        cellDiv.style.gridRow = cell.row;
        cellDiv.style.gridColumn = cell.col;
        cellDiv.id = `cell-${cell.id}`;
        cellDiv.innerHTML = `
            <div class="cell-category ${cell.catClass}">${cell.category}</div>
            <div class="cell-icon">${cell.icon}</div>
            <div class="cell-name">${cell.name}</div>
            <div class="token-container" id="tokens-${cell.id}"></div>
        `;
        grid.appendChild(cellDiv);
    });
};

window.updateCenterDisplay = function (cell) {
    const defaultDiv = document.getElementById('centerDefault');
    const landmarkDiv = document.getElementById('centerLandmark');

    if (!cell) {
        defaultDiv.style.display = 'block';
        landmarkDiv.style.display = 'none';
        return;
    }

    document.getElementById('centerImage').src = cell.img;
    document.getElementById('centerTitle').innerText = `${cell.icon} ${cell.name}`;
    document.getElementById('centerDesc').innerText = cell.desc;
    defaultDiv.style.display = 'none';
    landmarkDiv.style.display = 'flex';
};

window.updateTokens = function () {
    window.boardData.forEach(cell => {
        const container = document.getElementById(`tokens-${cell.id}`);
        if (container) container.innerHTML = '';
        const cellDiv = document.getElementById(`cell-${cell.id}`);
        
        const existingCrown = cellDiv?.querySelector('.crown-icon');
        if (existingCrown) existingCrown.remove();

        if (cellDiv) {
            cellDiv.classList.remove('highlight', 'owner-p1', 'owner-p2', 'owner-p3', 'owner-p4');
            const owner = window.landOwnership[cell.id];
            
            if (owner !== undefined) {
                cellDiv.classList.add(`owner-p${owner + 1}`);
                
                const upgradeLevel = window.landUpgrades[cell.id] || 0;
                if (upgradeLevel > 0) {
                    const crown = document.createElement('div');
                    crown.className = 'crown-icon';
                    crown.innerText = upgradeLevel === 2 ? '👑👑' : '👑';
                    crown.style.position = 'absolute';
                    crown.style.top = '-8px';
                    crown.style.right = '-4px';
                    crown.style.fontSize = '14px';
                    crown.style.zIndex = '20';
                    cellDiv.appendChild(crown);
                }
            }
        }
    });

    window.players.forEach((p, idx) => {
        if (!p || p.isEliminated) return;
        const container = document.getElementById(`tokens-${p.pos}`);
        if (container) {
            const token = document.createElement('div');
            token.className = `player-token`;
            token.innerText = p.animal;
            token.style.backgroundColor = p.colorBg;
            token.style.borderColor = p.colorBorder;
            container.appendChild(token);
        }
    });

    const currentPos = window.players[window.currentPlayer]?.pos;
    if (currentPos !== undefined) {
        const currentCellDiv = document.getElementById(`cell-${currentPos}`);
        if (currentCellDiv) currentCellDiv.classList.add('highlight');
    }

    const statusEl = document.getElementById('playerStatus');
    statusEl.innerHTML = '<div style="font-size:14px; font-weight:bold; color:#2563eb; margin-bottom:6px; text-align:center; padding-bottom:4px; border-bottom:2px dashed #93c5fd;">🏆 실시간 순위표</div>';
    
    const rankedPlayers = [...window.players]
        .map((p, idx) => ({ ...p, originalIdx: idx }))
        .sort((a, b) => (b.score - a.score) || (b.cards - a.cards));

    rankedPlayers.forEach((p, rank) => {
        if (!p) return;
        const isActive = (p.originalIdx === window.currentPlayer);
        const card = document.createElement('div');
        card.className = `player-card ${isActive ? 'active' : ''}`;

        let rankBadge = `${rank + 1}위`;
        if (rank === 0) rankBadge = '🥇';
        else if (rank === 1) rankBadge = '🥈';
        else if (rank === 2) rankBadge = '🥉';

        card.innerHTML = `
            <div class="player-header">
                <span>${rankBadge} <span style="background:${p.colorBg}; padding:2px 4px; border-radius:4px; border:1px solid ${p.colorBorder};">${p.animal} ${p.name}</span></span>
                <span>${window.boardData[p.pos]?.name || '출발'}</span>
            </div>
            <div class="player-score">자산: ${p.score}점 | 랜드마크: ${p.cards}개</div>
        `;
        statusEl.appendChild(card);
    });
};

window.updateTurnUI = function () {
    const badge = document.getElementById('turnBadge');
    const p = window.players[window.currentPlayer];
    if (badge) badge.innerText = p ? `${p.animal} ${p.name} 차례` : '대기 중';

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.innerText = "🎲 주사위 던지기";
    }

    const centerDiceBox = document.getElementById('centerDiceBox');
    if (centerDiceBox) centerDiceBox.innerText = '🎲 🎲';
    
    if (p) {
        const currentCell = window.boardData[p.pos];
        window.updateCenterDisplay(currentCell);
    }

    if (window.updateGameStatusInfo) window.updateGameStatusInfo();
};

window.checkWinCondition = function () {
    const activePlayers = window.players.filter(p => p && !p.isEliminated);
    if (activePlayers.length <= 1) {
        window.showWinModal(0);
        return true;
    }
    return false;
};

window.showWinModal = function (winnerIdx) {
    const modal = document.getElementById('winModal');
    if (!modal || modal.style.display === 'flex') return;
    window.Synth.play('win');

    const winner = window.players[winnerIdx];
    document.getElementById('winTitle').innerText = '🎉 게임 종료!';
    document.getElementById('winMessage').innerText = `${winner.animal} ${winner.name}님이 우승하셨습니다!`;

    const rankingEl = document.getElementById('winRanking');
    rankingEl.innerHTML = '';
    [...window.players]
        .sort((a, b) => b.score - a.score)
        .forEach((p, rank) => {
            const row = document.createElement('div');
            row.className = 'win-rank-row';
            row.innerHTML = `${rank + 1}위 ${p.animal} ${p.name} — ${p.score}점`;
            rankingEl.appendChild(row);
        });

    modal.style.display = 'flex';
};

window.rollDice = function () {
    if (window.isMoving) return;

    const p = window.players[window.currentPlayer];
    if (p) {
        const currentCell = window.boardData[p.pos];
        window.updateCenterDisplay(currentCell);
    }

    window.Synth.play('roll');

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) rollBtn.disabled = true;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const totalSteps = dice1 + dice2;
    window.rolledDouble = (dice1 === dice2);

    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let rollCount = 0;
    window.isMoving = true;

    const diceInterval = setInterval(() => {
        const r1 = Math.floor(Math.random() * 6) + 1;
        const r2 = Math.floor(Math.random() * 6) + 1;
        
        const centerDiceBox = document.getElementById('centerDiceBox');
        if (centerDiceBox) centerDiceBox.innerText = diceFaces[r1 - 1] + ' ' + diceFaces[r2 - 1];
        
        rollCount++;
        if (rollCount > 8) {
            clearInterval(diceInterval);
            if (centerDiceBox) centerDiceBox.innerText = diceFaces[dice1 - 1] + ' ' + diceFaces[dice2 - 1];
            if (rollBtn) rollBtn.innerText = `${totalSteps}칸 전진!`;

            setTimeout(() => window.movePlayer(totalSteps), 400);
        }
    }, 80);
};

window.movePlayer = function (steps) {
    let p = window.players[window.currentPlayer];
    let startPos = p.pos;
    let stepCount = 0;
    
    const isBackward = steps < 0;
    const targetSteps = Math.abs(steps);

    const moveInterval = setInterval(() => {
        stepCount++;
        window.Synth.play('move');
        
        if (isBackward) {
            startPos--;
            if (startPos < 0) startPos = window.boardData.length - 1;
        } else {
            startPos++;
            if (startPos >= window.boardData.length) startPos = 0;
        }
        
        const displayPos = startPos;
        const currentCell = window.boardData[displayPos];
        window.updateCenterDisplay(currentCell);
        
        if (!isBackward && displayPos === 0) p.score += 100;

        p.pos = displayPos;
        window.updateTokens();

        if (stepCount >= targetSteps) {
            clearInterval(moveInterval);
            setTimeout(() => {
                window.isMoving = false;
                window.handleCellLanding();
            }, 400);
        }
    }, 250);
};

window.handleCellLanding = function () {
    const p = window.players[window.currentPlayer];
    const currentCell = window.boardData[p.pos];
    
    if (currentCell.category === '특수공간' || currentCell.category === '이벤트') {
        window.handleSpecialSpace(currentCell);
        return;
    }
    
    const owner = window.landOwnership[p.pos];
    const upgradeLevel = window.landUpgrades[p.pos] || 0; 
    const cp = window.currentPlayer;
    
    if (owner !== undefined && owner !== cp) {
        let toll = upgradeLevel === 2 ? 200 : (upgradeLevel === 1 ? 100 : 50);
        p.score -= toll;
        window.players[owner].score += toll;
        window.updateTokens();
        if (window.checkWinCondition()) return;
        alert(`${currentCell.name}은(는) 다른 사람의 땅입니다! 통행료 ${toll}점 지불!`);
        window.nextTurn();
        return;
    }
    
    if (owner === cp) {
        if (upgradeLevel < 2 && currentCell.question) {
            window.isUpgradeAttempt = upgradeLevel + 1; 
            window.openQuizModal(currentCell, window.isUpgradeAttempt);
            return;
        } else {
            alert(`내 땅 [${currentCell.name}]입니다!`);
            window.nextTurn();
            return;
        }
    }
    
    if (owner === undefined && p.pos !== 0) {
        if (currentCell.question) {
            window.isUpgradeAttempt = 0; 
            window.openQuizModal(currentCell, 0);
        } else {
            window.landOwnership[p.pos] = cp; 
            window.updateTokens();
            window.nextTurn();
        }
    }
};

window.quizTimeout = null;
window.countdownInterval = null;

window.openQuizModal = function (cell, attemptLevel) {
    const modal = document.getElementById('quizModal');
    document.getElementById('modalCategory').innerText = attemptLevel > 0 ? '랜드마크 업그레이드' : cell.category;
    document.getElementById('modalTitle').innerText = cell.name;

    let qText = cell.question, qOpts = cell.options, qAns = cell.answer, qExp = cell.exp;
    if (attemptLevel === 1 && cell.question2) { qText = cell.question2; qOpts = cell.options2; qAns = cell.answer2; qExp = cell.exp2; }
    else if (attemptLevel === 2 && cell.question3) { qText = cell.question3; qOpts = cell.options3; qAns = cell.answer3; qExp = cell.exp3; }

    document.getElementById('modalQuestion').innerHTML = qText;
    const optionsContainer = document.getElementById('modalOptions');
    optionsContainer.innerHTML = '';
    
    if (Array.isArray(qOpts)) {
        qOpts.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerText = `${idx + 1}. ${opt}`;
            btn.onclick = () => window.checkAnswer(idx, parseInt(qAns), qExp);
            optionsContainer.appendChild(btn);
        });
    }

    document.getElementById('resultMsg').style.display = 'none';
    document.getElementById('btnNext').style.display = 'none';
    modal.style.display = 'flex';
};

window.closeQuizModal = function () {
    if (window.quizTimeout) {
        clearTimeout(window.quizTimeout);
        window.quizTimeout = null;
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    document.getElementById('quizModal').style.display = 'none';
    window.nextTurn();
};

window.nextTurn = function () {
    const playerCount = window.players.length;
    if (playerCount === 0) return;

    if (window.rolledDouble) {
        window.rolledDouble = false;
        alert(`🎲 더블입니다! ${window.players[window.currentPlayer].animal} ${window.players[window.currentPlayer].name}님이 한 번 더 주사위를 던집니다!`);
    } else {
        const prevPlayer = window.currentPlayer;
        window.currentPlayer = (window.currentPlayer + 1) % playerCount;

        if (window.currentPlayer === 0 && prevPlayer !== 0) {
            if (window.gameMode === 'turn') {
                window.currentTurnCount++;
                if (window.currentTurnCount > window.totalTurns) {
                    alert("🔄 모든 턴이 종료되었습니다!");
                    window.showWinModal(0);
                    return;
                }
            }
        }
    }

    if (window.skipPlayers[window.currentPlayer] > 0) {
        window.skipPlayers[window.currentPlayer]--;
        alert(`🏝️ ${window.players[window.currentPlayer].name}님은 한 턴 쉬어갑니다!`);
        window.nextTurn();
        return;
    }

    window.updateGameStatusInfo();
    window.updateTokens();
    window.updateTurnUI(); 
};

window.checkAnswer = function (selected, correct, explanation) {
    const resultMsg = document.getElementById('resultMsg');
    const btnNext = document.getElementById('btnNext');
    document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.disabled = true);

    const isCorrect = (selected === correct);
    const p = window.players[window.currentPlayer];

    if (isCorrect) {
        window.Synth.play('correct');
        resultMsg.className = 'result-msg correct';
        if (window.isUpgradeAttempt > 0) {
            window.landUpgrades[p.pos] = window.isUpgradeAttempt;
            resultMsg.innerText = `⭕ 정답입니다! 랜드마크가 업그레이드되었습니다!\n💡 ${explanation}`;
        } else {
            window.landOwnership[p.pos] = window.currentPlayer;
            p.score += 100;
            p.cards += 1;
            resultMsg.innerText = `⭕ 정답입니다! (+100점 / 땅 획득)\n💡 ${explanation}`;
        }
        window.updateTokens();
        if (window.checkWinCondition()) return;
    } else {
        window.Synth.play('wrong');
        resultMsg.className = 'result-msg wrong';
        resultMsg.innerText = `❌ 아쉽네요! 정답이 아닙니다.\n💡 ${explanation}`;
    }

    resultMsg.style.display = 'block';
    btnNext.style.display = 'block';

    if (window.quizTimeout) clearTimeout(window.quizTimeout);
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    let timeLeft = 3;
    btnNext.innerText = `${timeLeft}초 뒤 다음 사람으로 넘어갑니다...`;

    window.countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            btnNext.innerText = `${timeLeft}초 뒤 다음 사람으로 넘어갑니다...`;
        } else {
            clearInterval(window.countdownInterval);
        }
    }, 1000);

    window.quizTimeout = setTimeout(() => {
        window.closeQuizModal();
    }, 3000);
};

window.toggleModeSettings = function(mode) {
    document.getElementById('timeSettingBox').style.display = mode === 'time' ? 'block' : 'none';
    document.getElementById('turnSettingBox').style.display = mode === 'turn' ? 'block' : 'none';
};

window.startTimer = function() {
    window.timerInterval = setInterval(() => {
        window.timeLeft--;
        window.updateGameStatusInfo();
        if (window.timeLeft <= 0) {
            clearInterval(window.timerInterval);
            alert("⏰ 시간이 종료되었습니다!");
            window.showWinModal(0);
        }
    }, 1000);
};

window.updateGameStatusInfo = function() {
    const infoEl = document.getElementById('gameStatusInfo');
    if (!infoEl) return;
    if (window.gameMode === 'time') {
        const min = Math.floor(window.timeLeft / 60);
        const sec = window.timeLeft % 60;
        infoEl.innerHTML = `⏱️ 남은 시간: <span style="color: #e11d48;">${min}분 ${sec < 10 ? '0' : ''}${sec}초</span>`;
    } else {
        infoEl.innerHTML = `🔄 턴 제한: <span style="color: #2563eb;">${window.currentTurnCount} / ${window.totalTurns} 턴</span>`;
    }
};

/* ⚙️ 관리자 모드 (데이터 유실 방지를 위한 안내 전용 창) */
window.openAdminModal = function() {
    const list = document.getElementById('adminImageList');
    list.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 15px; font-weight: bold; margin-bottom: 10px; color: #2563eb;">🛡️ 구글 시트 데이터 안전 보호 모드</p>
            <p style="font-size: 13px; color: #475569;">
                데이터 유실 사고를 방지하기 위해, 칸 이름·사진·퀴즈 수정은 <b>구글 시트(스프레드시트) 화면에서 직접 입력</b>해 주세요.<br><br>
                구글 시트에서 내용을 수정하고 저장하신 뒤 게임을 새로고침하면 실시간으로 반영됩니다!
            </p>
        </div>
    `;
    document.getElementById('adminModal').style.display = 'flex';
};

window.closeAdminModal = function() {
    document.getElementById('adminModal').style.display = 'none';
};

// 저장 기능 제거 (시트 데이터 보호)
window.saveAdminSettings = function() {
    window.closeAdminModal();
    alert('✅ 구글 시트 원본 데이터를 보호하기 위해 저장 기능이 안전 모드로 전환되었습니다. 구글 시트에서 직접 수정해 주세요!');
};