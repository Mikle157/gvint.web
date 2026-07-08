// Global application state
const APP = {
    currentUser: null,
    users: [],
    tournaments: [],
    currentAuthTab: 'login',
    audioContext: null,
    backgroundDrone: null,
    isAudioOn: false,
    activeTournamentId: null,
    activeMatchDetails: null, // { tournamentId, roundIndex, matchIndex }

    init() {
        this.loadState();
        this.bindEvents();
        this.renderAll();
        
        // Listen to hash changes for SPA router
        window.addEventListener('hashchange', () => this.handleRouting());
        this.handleRouting();
    },

    loadState() {
        // Load users (bots + registered players)
        const savedUsers = localStorage.getItem('gwent_users');
        if (savedUsers) {
            this.users = JSON.parse(savedUsers);
        } else {
            this.users = this.generateBotPool();
            this.saveUsers();
        }

        // Load tournaments
        const savedTournaments = localStorage.getItem('gwent_tournaments');
        if (savedTournaments) {
            this.tournaments = JSON.parse(savedTournaments);
        } else {
            this.tournaments = this.generateInitialTournaments();
            this.saveTournaments();
        }

        // Load current user session
        const savedSession = localStorage.getItem('gwent_current_user');
        if (savedSession) {
            this.currentUser = JSON.parse(savedSession);
        }
    },

    saveUsers() {
        localStorage.setItem('gwent_users', JSON.stringify(this.users));
    },

    saveTournaments() {
        localStorage.setItem('gwent_tournaments', JSON.stringify(this.tournaments));
    },

    saveSession() {
        if (this.currentUser) {
            localStorage.setItem('gwent_current_user', JSON.stringify(this.currentUser));
            // Also update in users pool
            const idx = this.users.findIndex(u => u.id === this.currentUser.id);
            if (idx !== -1) {
                this.users[idx] = this.currentUser;
                this.saveUsers();
            }
        } else {
            localStorage.removeItem('gwent_current_user');
        }
    },

    generateBotPool() {
        return [
            { id: 'bot_geralt', name: 'Ґеральт з Рівії', faction: 'realms', mmr: 1250, wins: 45, losses: 12, isBot: true },
            { id: 'bot_yennefer', name: 'Йеннефер з Венґерберґа', faction: 'nilfgaard', mmr: 1180, wins: 38, losses: 15, isBot: true },
            { id: 'bot_ciri', name: 'Цірілла', faction: 'skellige', mmr: 1200, wins: 42, losses: 14, isBot: true },
            { id: 'bot_triss', name: 'Трісс Мерігольд', faction: 'scoiatael', mmr: 1080, wins: 28, losses: 20, isBot: true },
            { id: 'bot_jaskier', name: 'Любисток', faction: 'realms', mmr: 850, wins: 12, losses: 35, isBot: true },
            { id: 'bot_eredin', name: 'Ередін Бреакк Глас', faction: 'monsters', mmr: 1120, wins: 31, losses: 19, isBot: true },
            { id: 'bot_vesemir', name: 'Весемир', faction: 'realms', mmr: 1040, wins: 24, losses: 18, isBot: true },
            { id: 'bot_letho', name: 'Лето з Ґулети', faction: 'nilfgaard', mmr: 1140, wins: 33, losses: 16, isBot: true },
            { id: 'bot_saskia', name: 'Саскія Дракон', faction: 'scoiatael', mmr: 1060, wins: 26, losses: 17, isBot: true },
            { id: 'bot_olaf', name: 'Ведмідь Олаф', faction: 'skellige', mmr: 1020, wins: 20, losses: 22, isBot: true }
        ];
    },

    generateInitialTournaments() {
        // Create some historical or active tournaments populated with bots
        const bots = this.users.filter(u => u.isBot);
        
        // Tournament 1: Novigrad Open (Active)
        const t1Players = bots.slice(0, 8);
        const bracket1 = window.BRACKET.generateInitialBracket(t1Players);

        // Tournament 2: Royal Wyzima Cup (Upcoming)
        const t2Players = bots.slice(2, 6); // Only 4 bots registered, user can register

        return [
            {
                id: 't_novigrad',
                name: 'Кубок Новіграда (Novigrad Open)',
                format: 'Класичний Гвінт',
                prize: '1500 Орен',
                status: 'active',
                players: t1Players,
                bracket: bracket1,
                winnerId: null
            },
            {
                id: 't_wyzima',
                name: 'Королівський турнір у Визимі',
                format: 'Без Обмежень',
                prize: '3000 Орен',
                status: 'upcoming',
                players: t2Players,
                bracket: [],
                winnerId: null
            }
        ];
    },

    bindEvents() {
        // Form submissions are handled in HTML via inline APP.handleAuthSubmit
        // Click sound for buttons
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.classList.contains('gwent-card-item')) {
                this.playClickSound();
            }
        });
    },

    handleRouting() {
        const hash = window.location.hash || '#tavern';
        let targetSection = 'section-tavern';

        if (hash === '#tournaments') targetSection = 'section-tournaments';
        if (hash === '#profile') targetSection = 'section-profile';
        if (hash === '#leaderboard') targetSection = 'section-leaderboard';

        // Update active class in navbar
        document.querySelectorAll('#main-nav .nav-link').forEach(link => {
            if (link.getAttribute('data-target') === targetSection) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        this.navigateToSection(targetSection);
    },

    navigateToSection(sectionId) {
        // If playing a match, prevent leaving unless surrendered
        if (sectionId !== 'section-match-board' && window.GAME_SIMULATOR && window.GAME_SIMULATOR.state && window.GAME_SIMULATOR.state.playerRoundsWon < 2 && window.GAME_SIMULATOR.state.opponentRoundsWon < 2) {
            if (!confirm('Ви дійсно хочете залишити партію? Це призведе до поразки.')) {
                window.location.hash = '#tournaments';
                return;
            } else {
                this.surrenderMatch();
            }
        }

        // Hide all sections, show target
        document.querySelectorAll('.page-section').forEach(sec => {
            sec.classList.remove('active');
        });

        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.add('active');
            
            // Perform view updates on section entrance
            if (sectionId === 'section-tavern') this.renderTavern();
            if (sectionId === 'section-tournaments') this.renderTournaments();
            if (sectionId === 'section-profile') this.renderProfile();
            if (sectionId === 'section-leaderboard') this.renderLeaderboard();
        }
    },

    renderAll() {
        this.renderUserWidget();
        this.renderTavern();
        this.renderTournaments();
        this.renderProfile();
        this.renderLeaderboard();
    },

    renderUserWidget() {
        const authSection = document.getElementById('user-auth-section');
        if (!authSection) return;

        if (this.currentUser) {
            const faction = window.GWENT_FACTIONS[this.currentUser.faction];
            authSection.innerHTML = `
                <div class="user-status-widget">
                    <div class="user-profile-summary">
                        <span class="user-username">${this.currentUser.name}</span>
                        <span class="user-faction" style="color: ${faction.themeColor}">${faction.name} ${faction.emblem}</span>
                    </div>
                    <div class="user-avatar" onclick="APP.navigateToSection('section-profile')" style="cursor:pointer; border-color: ${faction.themeColor}">
                        ${faction.emblem}
                    </div>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <button class="btn btn-accent" onclick="APP.openAuthModal('login')">Вхід / Реєстрація</button>
            `;
        }
    },

    // 1. Tavern Page View
    renderTavern() {
        // Load stats
        document.getElementById('stats-total-players').innerText = this.users.length;
        document.getElementById('stats-active-tournaments').innerText = this.tournaments.length;
        document.getElementById('stats-total-matches').innerText = this.tournaments.reduce((acc, t) => {
            if (t.bracket && t.bracket.length > 0) {
                return acc + t.bracket.reduce((sum, round) => sum + round.filter(m => m.status === 'completed').length, 0);
            }
            return acc;
        }, 0);

        // Load tournaments preview
        const container = document.getElementById('tavern-tournaments-list');
        if (!container) return;
        container.innerHTML = '';

        this.tournaments.slice(0, 3).forEach(t => {
            const card = document.createElement('div');
            card.className = 'tournament-card';
            card.innerHTML = `
                <div class="tournament-info">
                    <h3>${t.name}</h3>
                    <div class="tournament-meta">
                        <span>Формат: <strong>${t.format}</strong></span>
                        <span>Приз: <strong>${t.prize}</strong></span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="tournament-status-tag ${t.status}">${t.status === 'active' ? 'Активний' : (t.status === 'upcoming' ? 'Набір' : 'Завершено')}</span>
                    <button class="btn btn-secondary" style="padding: 6px 15px; font-size: 0.75rem;" onclick="APP.viewTournament('${t.id}')">Перегляд</button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    // 2. Tournaments Page View
    renderTournaments() {
        const container = document.getElementById('main-tournaments-list');
        if (!container) return;
        container.innerHTML = '';

        this.tournaments.forEach(t => {
            const isRegistered = t.players.some(p => p.id === this.currentUser?.id);
            const card = document.createElement('div');
            card.className = 'tournament-card';
            card.innerHTML = `
                <div class="tournament-info">
                    <h3>${t.name}</h3>
                    <div class="tournament-meta">
                        <span>Формат: <strong>${t.format}</strong></span>
                        <span>Призовий фонд: <strong>${t.prize}</strong></span>
                        <span>Гравців: <strong>${t.players.length}/8</strong></span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${isRegistered ? '<span class="text-muted" style="font-size:0.8rem; font-style:italic;">Ви берете участь</span>' : ''}
                    <span class="tournament-status-tag ${t.status}">${t.status === 'active' ? 'Активний' : (t.status === 'upcoming' ? 'Набір' : 'Завершено')}</span>
                    <button class="btn btn-accent" style="padding: 6px 15px; font-size: 0.75rem;" onclick="APP.viewTournament('${t.id}')">Переглянути сітку</button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    viewTournament(id) {
        this.activeTournamentId = id;
        this.showTournamentDetails();
    },

    showTournamentsList() {
        document.getElementById('tournaments-list-view').style.display = 'block';
        document.getElementById('tournament-detail-view').style.display = 'none';
        this.renderTournaments();
    },

    showTournamentDetails() {
        const t = this.tournaments.find(x => x.id === this.activeTournamentId);
        if (!t) return;

        document.getElementById('tournaments-list-view').style.display = 'none';
        const detailView = document.getElementById('tournament-detail-view');
        detailView.style.display = 'block';

        document.getElementById('active-tournament-title').innerText = t.name;
        document.getElementById('active-tournament-status').innerText = t.status === 'active' ? 'Активний' : (t.status === 'upcoming' ? 'Набір гравців' : 'Завершено');
        document.getElementById('active-tournament-prize').innerText = t.prize;

        // Render Action Buttons (Join, Start, Simulate)
        const actionsContainer = document.getElementById('tournament-actions-container');
        actionsContainer.innerHTML = '';

        const isUserRegistered = t.players.some(p => p.id === this.currentUser?.id);

        if (t.status === 'upcoming') {
            if (isUserRegistered) {
                const leaveBtn = document.createElement('button');
                leaveBtn.className = 'btn btn-danger';
                leaveBtn.innerText = 'Скасувати участь';
                leaveBtn.onclick = () => this.leaveTournament(t.id);
                actionsContainer.appendChild(leaveBtn);
            } else {
                const joinBtn = document.createElement('button');
                joinBtn.className = 'btn btn-accent pulsing';
                joinBtn.innerText = 'Зареєструватися';
                joinBtn.onclick = () => this.joinTournament(t.id);
                actionsContainer.appendChild(joinBtn);
            }

            // Let user start it if we have players
            if (t.players.length >= 2) {
                const startBtn = document.createElement('button');
                startBtn.className = 'btn btn-accent';
                startBtn.innerText = 'Розпочати сітку';
                startBtn.style.marginLeft = '10px';
                startBtn.onclick = () => this.openCustomBracketModal(t.id);
                actionsContainer.appendChild(startBtn);
            }
        } else if (t.status === 'active') {
            // Auto simulate bot vs bot
            const simBtn = document.createElement('button');
            simBtn.className = 'btn btn-secondary';
            simBtn.innerText = 'Симулювати ботів';
            simBtn.onclick = () => {
                const simulated = window.BRACKET.simulateBotMatches(t);
                if (simulated) {
                    this.saveTournaments();
                    this.renderActiveTournament();
                    this.renderLeaderboard();
                } else {
                    alert('Немає матчів ботів, готових до симуляції. Гравцеві потрібно зіграти свій матч!');
                }
            };
            actionsContainer.appendChild(simBtn);
        } else if (t.status === 'completed') {
            const winner = this.users.find(u => u.id === t.winnerId);
            const winnerName = winner ? winner.name : 'Невідомо';
            actionsContainer.innerHTML = `<span class="gold" style="font-family: var(--font-header); font-weight:700;">Переможець кубка: 👑 ${winnerName}</span>`;
        }

        this.renderActiveTournament();
    },

    renderActiveTournament() {
        const t = this.tournaments.find(x => x.id === this.activeTournamentId);
        if (!t) return;

        if (t.bracket && t.bracket.length > 0) {
            window.BRACKET.renderBracket('bracket-container', t, (tournamentId, rIndex, mIndex) => {
                this.launchMatch(tournamentId, rIndex, mIndex);
            });
        } else {
            const container = document.getElementById('bracket-container');
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">
                    Турнірна сітка ще не згенерована. Потрібно почати турнір, коли зберуться гравці.
                </div>
            `;
        }
    },

    joinTournament(id) {
        if (!this.currentUser) {
            alert('Будь ласка, спочатку увійдіть або зареєструйтесь.');
            this.openAuthModal('login');
            return;
        }

        const t = this.tournaments.find(x => x.id === id);
        if (t.players.length >= 8) {
            alert('Вибачте, цей турнір уже заповнений.');
            return;
        }

        t.players.push(this.currentUser);
        this.saveTournaments();
        this.showTournamentDetails();
    },

    leaveTournament(id) {
        const t = this.tournaments.find(x => x.id === id);
        t.players = t.players.filter(p => p.id !== this.currentUser.id);
        this.saveTournaments();
        this.showTournamentDetails();
    },

    startTournament(id) {
        const t = this.tournaments.find(x => x.id === id);
        
        // Fill remaining slots with random bots up to 8 players
        const bots = this.users.filter(u => u.isBot);
        while (t.players.length < 8) {
            const randomBot = bots[Math.floor(Math.random() * bots.length)];
            if (!t.players.some(p => p.id === randomBot.id)) {
                t.players.push(randomBot);
            }
        }

        t.status = 'active';
        t.bracket = window.BRACKET.generateInitialBracket(t.players);
        
        this.saveTournaments();
        this.showTournamentDetails();
    },

    createNewTournament() {
        const name = prompt('Введіть назву турніру:', 'Кубок Скелліге');
        if (!name) return;

        const prize = prompt('Введіть призовий фонд:', '1200 Орен');
        if (!prize) return;

        const newT = {
            id: `t_${Date.now()}`,
            name: name,
            format: 'Випадкова Фракція',
            prize: prize,
            status: 'upcoming',
            players: [],
            bracket: [],
            winnerId: null
        };

        this.tournaments.push(newT);
        this.saveTournaments();
        this.renderTournaments();
        this.viewTournament(newT.id);
    },

    // 3. Profiles Page View
    renderProfile() {
        const unauth = document.getElementById('profile-unauthenticated-msg');
        const auth = document.getElementById('profile-authenticated-view');

        if (!this.currentUser) {
            unauth.style.display = 'block';
            auth.style.display = 'none';
            return;
        }

        unauth.style.display = 'none';
        auth.style.display = 'grid';

        const faction = window.GWENT_FACTIONS[this.currentUser.faction];
        
        // Avatar and stats
        document.getElementById('profile-avatar').innerText = faction.emblem;
        document.getElementById('profile-username').innerText = this.currentUser.name;
        document.getElementById('profile-faction-name').innerText = faction.name;
        document.getElementById('profile-stat-mmr').innerText = this.currentUser.mmr || 1000;
        document.getElementById('profile-stat-wins').innerText = this.currentUser.wins || 0;

        document.getElementById('profile-select-faction').value = this.currentUser.faction;

        // Render Deck Cards
        this.renderDeckCards();
    },

    changeUserFaction(factionId) {
        if (!this.currentUser) return;
        this.currentUser.faction = factionId;
        this.saveSession();
        this.renderUserWidget();
        this.renderProfile();
    },

    renderDeckCards() {
        const container = document.getElementById('deck-cards-container');
        if (!container) return;
        container.innerHTML = '';

        const faction = this.currentUser.faction;
        const factionCards = window.GWENT_CARDS[faction] || [];
        const neutralCards = window.GWENT_CARDS.neutral || [];

        const fullDeck = [...factionCards, ...neutralCards].filter(c => c.type !== 'leader');

        // Deck Count & Power calculations
        document.getElementById('deck-count-total').innerText = `${fullDeck.length}/15`;
        const avgPower = fullDeck.reduce((sum, c) => sum + c.power, 0) / (fullDeck.length || 1);
        document.getElementById('deck-average-power').innerText = `${avgPower.toFixed(1)}⚔️`;

        // Render cards
        fullDeck.forEach(c => {
            const cardEl = document.createElement('div');
            cardEl.className = `gwent-card-item ${c.ability || 'none'} ${c.type === 'hero' || c.ability === 'hero' ? 'hero' : ''}`;
            cardEl.title = c.desc || '';
            cardEl.innerHTML = `
                <div class="card-power">${c.power}</div>
                <div class="card-icon">${c.image}</div>
                <div class="card-title">${c.name}</div>
                <div class="card-ability-indicator">${c.ability !== 'none' ? c.ability.toUpperCase() : ''}</div>
            `;
            cardEl.onclick = () => this.showCardDetails(c.id, faction);
            container.appendChild(cardEl);
        });
    },

    // 4. Leaderboard View
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Sort players by MMR
        const sorted = [...this.users].sort((a, b) => (b.mmr || 1000) - (a.mmr || 1000));

        sorted.forEach((u, idx) => {
            const tr = document.createElement('tr');
            if (this.currentUser && u.id === this.currentUser.id) {
                tr.className = 'current-user-row';
            }

            const faction = window.GWENT_FACTIONS[u.faction];

            tr.innerHTML = `
                <td class="rank-cell">#${idx + 1}</td>
                <td>${u.name} ${u.isBot ? '<span class="text-muted" style="font-size:0.75rem;">(Бот)</span>' : ''}</td>
                <td style="color: ${faction.themeColor}">${faction.emblem} ${faction.name}</td>
                <td style="text-align: right; font-weight:700;">${u.mmr || 1000}</td>
                <td style="text-align: right;">${u.wins || 0}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    // 5. Auth Modals
    openAuthModal(tab) {
        document.getElementById('auth-modal').classList.add('active');
        this.switchAuthTab(tab);
    },

    closeAuthModal() {
        document.getElementById('auth-modal').classList.remove('active');
    },

    switchAuthTab(tab) {
        this.currentAuthTab = tab;
        const tLogin = document.getElementById('tab-login');
        const tRegister = document.getElementById('tab-register');
        const fLogin = document.getElementById('form-login');
        const fRegister = document.getElementById('form-register');

        if (tab === 'login') {
            tLogin.classList.add('active');
            tRegister.classList.remove('active');
            fLogin.style.display = 'block';
            fRegister.style.display = 'none';
        } else {
            tLogin.classList.remove('active');
            tRegister.classList.add('active');
            fLogin.style.display = 'none';
            fRegister.style.display = 'block';
        }
    },

    handleAuthSubmit(event, action) {
        event.preventDefault();
        
        if (action === 'login') {
            const username = document.getElementById('login-username').value.trim();
            if (!username) return;

            // Find user in pool
            let user = this.users.find(u => u.name.toLowerCase() === username.toLowerCase() && !u.isBot);
            if (!user) {
                alert('Гравця з таким ім\'ям не знайдено. Будь ласка, зареєструйтесь!');
                this.switchAuthTab('register');
                document.getElementById('register-username').value = username;
                return;
            }

            this.currentUser = user;
            this.saveSession();
            this.closeAuthModal();
            this.renderAll();
            this.playWinMelody();
        } else {
            const username = document.getElementById('register-username').value.trim();
            const faction = document.getElementById('register-faction').value;

            if (!username) return;

            // Check duplicate
            if (this.users.some(u => u.name.toLowerCase() === username.toLowerCase())) {
                alert('Це ім\'я вже зайняте. Оберіть інше.');
                return;
            }

            const newUser = {
                id: `user_${Date.now()}`,
                name: username,
                faction: faction,
                mmr: 1000,
                wins: 0,
                losses: 0,
                isBot: false
            };

            this.users.push(newUser);
            this.saveUsers();
            this.currentUser = newUser;
            this.saveSession();
            this.closeAuthModal();
            this.renderAll();
            this.playWinMelody();
        }
    },

    logout() {
        this.currentUser = null;
        this.saveSession();
        this.renderAll();
        window.location.hash = '#tavern';
    },

    // 6. Match Gameplay and Connection to Gwent Simulator
    launchMatch(tournamentId, rIndex, mIndex) {
        const t = this.tournaments.find(x => x.id === tournamentId);
        const match = t.bracket[rIndex][mIndex];

        this.activeMatchDetails = { tournamentId, roundIndex: rIndex, matchIndex: mIndex };
        
        // Match must have both players, and one must be user
        const opponent = match.player1.id === this.currentUser.id ? match.player2 : match.player1;

        match.status = 'active';
        this.saveTournaments();

        this.navigateToSection('section-match-board');

        // Start interactive game
        window.GAME_SIMULATOR.startGame(this.currentUser, opponent, (winnerId) => {
            this.resolveMatch(winnerId);
        });
    },

    resolveMatch(winnerId) {
        if (!this.activeMatchDetails) {
            // This is a Quick Play match!
            const game = window.GAME_SIMULATOR.state;
            const p1 = game.player;
            const p2 = game.opponent;
            const userWon = winnerId === p1.id;

            // Update user MMR in memory & database
            const updateMMR = (userId, win) => {
                const u = this.users.find(x => x.id === userId);
                if (u) {
                    const mmrChange = win ? 25 : -20;
                    u.mmr = Math.max(100, (u.mmr || 1000) + mmrChange);
                    if (win) {
                        u.wins = (u.wins || 0) + 1;
                    } else {
                        u.losses = (u.losses || 0) + 1;
                    }
                }
            };
            updateMMR(p1.id, userWon);
            updateMMR(p2.id, !userWon);

            if (this.currentUser) {
                const currentCopy = this.users.find(u => u.id === this.currentUser.id);
                this.currentUser = currentCopy;
                this.saveSession();
            }

            this.saveUsers();
            window.GAME_SIMULATOR.state = null;

            if (userWon) {
                this.playWinMelody();
                alert(`Перемога у товариському матчі! +25 MMR.`);
            } else {
                this.playLoseMelody();
                alert(`Поразка у товариському матчі. -20 MMR.`);
            }

            this.navigateToSection('section-tavern');
            return;
        }

        const { tournamentId, roundIndex, matchIndex } = this.activeMatchDetails;
        const t = this.tournaments.find(x => x.id === tournamentId);
        const match = t.bracket[roundIndex][matchIndex];

        // Update scores and match status
        match.status = 'completed';
        match.winnerId = winnerId;

        // Cumulative round scores simulated inside game-simulator
        const game = window.GAME_SIMULATOR.state;
        match.score1 = game.playerRoundsWon;
        match.score2 = game.opponentRoundsWon;

        // Award MMR to players
        const p1 = match.player1;
        const p2 = match.player2;

        const userWon = winnerId === this.currentUser.id;

        // Update users database MMR
        const updateMMR = (userId, win) => {
            const u = this.users.find(x => x.id === userId);
            if (u) {
                const mmrChange = win ? 25 : -20;
                u.mmr = Math.max(100, (u.mmr || 1000) + mmrChange);
                if (win) {
                    u.wins = (u.wins || 0) + 1;
                } else {
                    u.losses = (u.losses || 0) + 1;
                }
            }
        };

        updateMMR(p1.id, winnerId === p1.id);
        updateMMR(p2.id, winnerId === p2.id);

        // Update current user cached copy
        const currentCopy = this.users.find(u => u.id === this.currentUser.id);
        this.currentUser = currentCopy;
        this.saveSession();

        // Advance winner in bracket
        window.BRACKET.advanceWinner(t, roundIndex, matchIndex, winnerId);

        this.saveTournaments();
        this.activeMatchDetails = null;

        // Clean up Gwent board state
        window.GAME_SIMULATOR.state = null;

        // Play matching chime
        if (userWon) {
            this.playWinMelody();
            alert('Вітаємо з Перемогою в матчі! +25 MMR.');
        } else {
            this.playLoseMelody();
            alert('Поразка. Спробуйте ще раз! -20 MMR.');
        }

        // Return to tournaments
        this.navigateToSection('section-tournaments');
        this.showTournamentDetails();
    },

    surrenderMatch() {
        if (!this.activeMatchDetails) {
            // Quickplay surrender
            const game = window.GAME_SIMULATOR.state;
            if (game) {
                this.resolveMatch(game.opponent.id);
            }
            return;
        }

        const { tournamentId, roundIndex, matchIndex } = this.activeMatchDetails;
        const t = this.tournaments.find(x => x.id === tournamentId);
        const match = t.bracket[roundIndex][matchIndex];

        const opponent = match.player1.id === this.currentUser.id ? match.player2 : match.player1;
        
        // Resolve match in opponent favor
        this.resolveMatch(opponent.id);
    },

    // --- QUICK PLAY METHODS ---
    openQuickPlayModal() {
        if (!this.currentUser) {
            alert('Будь ласка, спочатку увійдіть або зареєструйтесь.');
            this.openAuthModal('login');
            return;
        }
        
        const select = document.getElementById('quickplay-opponent');
        select.innerHTML = '';
        
        const bots = this.users.filter(u => u.isBot);
        bots.forEach(bot => {
            const opt = document.createElement('option');
            opt.value = bot.id;
            opt.innerText = `${bot.name} (${window.GWENT_FACTIONS[bot.faction].emblem} MMR: ${bot.mmr})`;
            select.appendChild(opt);
        });

        if (bots.length > 0) {
            this.updateQuickPlayFactionSelect(bots[0].id);
        }

        document.getElementById('quickplay-modal').classList.add('active');
    },

    closeQuickPlayModal() {
        document.getElementById('quickplay-modal').classList.remove('active');
    },

    updateQuickPlayFactionSelect(botId) {
        const bot = this.users.find(u => u.id === botId);
        if (bot) {
            document.getElementById('quickplay-faction').value = bot.faction;
        }
    },

    handleQuickPlaySubmit(event) {
        event.preventDefault();
        const botId = document.getElementById('quickplay-opponent').value;
        const botFaction = document.getElementById('quickplay-faction').value;
        
        const bot = this.users.find(u => u.id === botId);
        // Create custom copy for match with selected faction
        const opponentCopy = {
            ...bot,
            faction: botFaction
        };

        this.closeQuickPlayModal();
        this.navigateToSection('section-match-board');

        // Start friendly match
        window.GAME_SIMULATOR.startGame(this.currentUser, opponentCopy, (winnerId) => {
            this.resolveMatch(winnerId);
        });
    },

    // --- CUSTOM BRACKET BUILDER METHODS ---
    openCustomBracketModal(tournamentId) {
        this.activeTournamentId = tournamentId;
        const grid = document.getElementById('bracket-player-selector-grid');
        grid.innerHTML = '';

        this.selectedBracketPlayerIds = [];

        // Pre-select current user if available
        if (this.currentUser) {
            this.selectedBracketPlayerIds.push(this.currentUser.id);
        }

        // Render options
        this.users.forEach(u => {
            const isSelected = this.selectedBracketPlayerIds.includes(u.id);
            const faction = window.GWENT_FACTIONS[u.faction];
            
            const item = document.createElement('div');
            item.className = `selector-item ${isSelected ? 'selected' : ''}`;
            item.dataset.playerId = u.id;
            item.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="APP.toggleBracketPlayer('${u.id}')">
                <div class="selector-player-info">
                    <span class="selector-player-name">${u.name} ${u.isBot ? '(Бот)' : '(Ви)'}</span>
                    <span class="selector-player-meta" style="color: ${faction.themeColor}">${faction.emblem} ${faction.name} | MMR: ${u.mmr}</span>
                </div>
            `;
            // clicking whole item checks it
            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = item.querySelector('input');
                    cb.checked = !cb.checked;
                    this.toggleBracketPlayer(u.id);
                }
            });

            grid.appendChild(item);
        });

        this.updateBracketSelectedUI();
        document.getElementById('custom-bracket-modal').classList.add('active');
    },

    closeCustomBracketModal() {
        document.getElementById('custom-bracket-modal').classList.remove('active');
    },

    toggleBracketPlayer(id) {
        const idx = this.selectedBracketPlayerIds.indexOf(id);
        if (idx !== -1) {
            this.selectedBracketPlayerIds.splice(idx, 1);
        } else {
            if (this.selectedBracketPlayerIds.length >= 8) {
                alert('Ви можете вибрати не більше 8 учасників!');
                // Uncheck in DOM
                const item = document.querySelector(`.selector-item[data-player-id="${id}"]`);
                if (item) {
                    item.querySelector('input').checked = false;
                }
                return;
            }
            this.selectedBracketPlayerIds.push(id);
        }

        this.updateBracketSelectedUI();
    },

    updateBracketSelectedUI() {
        // Update selection styles in DOM
        document.querySelectorAll('.selector-item').forEach(item => {
            const playerId = item.dataset.playerId;
            const cb = item.querySelector('input');
            if (this.selectedBracketPlayerIds.includes(playerId)) {
                item.classList.add('selected');
                cb.checked = true;
            } else {
                item.classList.remove('selected');
                cb.checked = false;
            }
        });

        const count = this.selectedBracketPlayerIds.length;
        document.getElementById('bracket-selected-count').innerText = `Обрано: ${count} з 8 гравців`;
        
        const btn = document.getElementById('btn-generate-bracket-submit');
        if (count === 8) {
            btn.removeAttribute('disabled');
        } else {
            btn.setAttribute('disabled', 'true');
        }
    },

    autoFillBracketPlayers() {
        this.selectedBracketPlayerIds = [];
        if (this.currentUser) {
            this.selectedBracketPlayerIds.push(this.currentUser.id);
        }

        const bots = this.users.filter(u => u.isBot);
        // Shuffle bots
        bots.sort(() => Math.random() - 0.5);

        for (let i = 0; i < bots.length; i++) {
            if (this.selectedBracketPlayerIds.length < 8) {
                this.selectedBracketPlayerIds.push(bots[i].id);
            }
        }

        this.updateBracketSelectedUI();
    },

    submitCustomBracket() {
        if (this.selectedBracketPlayerIds.length !== 8) return;

        const t = this.tournaments.find(x => x.id === this.activeTournamentId);
        if (!t) return;

        // Resolve selected participants
        t.players = this.selectedBracketPlayerIds.map(id => this.users.find(u => u.id === id));
        t.status = 'active';
        t.bracket = window.BRACKET.generateInitialBracket(t.players);

        this.saveTournaments();
        this.closeCustomBracketModal();
        this.showTournamentDetails();
    },

    // --- CARD DETAILS POPUP METHODS ---
    showCardDetails(cardId, faction) {
        // Find card in faction pool or neutral pool
        const factionCards = window.GWENT_CARDS[faction] || [];
        const neutralCards = window.GWENT_CARDS.neutral || [];
        const card = [...factionCards, ...neutralCards].find(c => c.id === cardId);

        if (!card) return;

        const detailContent = document.getElementById('card-details-content');
        const facMeta = window.GWENT_FACTIONS[faction];

        detailContent.innerHTML = `
            <div class="card-detail-visual">
                <div class="gwent-card-item ${card.ability || 'none'} ${card.type === 'hero' || card.ability === 'hero' ? 'hero' : ''}">
                    <div class="card-power">${card.power}</div>
                    <div class="card-icon">${card.image}</div>
                    <div class="card-title">${card.name}</div>
                    <div class="card-ability-indicator">${card.ability !== 'none' ? card.ability.toUpperCase() : ''}</div>
                </div>
            </div>
            <div class="card-detail-info">
                <h2 class="card-detail-name">${card.name}</h2>
                <div class="card-detail-row-meta">
                    Фракція: <strong>${facMeta.name} ${facMeta.emblem}</strong><br>
                    Ряд: <strong>${card.type === 'close' ? 'Рукопашний ⚔️' : (card.type === 'ranged' ? 'Дальнобійний 🏹' : (card.type === 'siege' ? 'Облоговий ☄️' : 'Спеціальний ✨'))}</strong>
                </div>
                <div class="card-detail-description">
                    "${card.desc || 'Звичайна бойова карта для розігрування на столі.'}"
                </div>
                <div class="card-detail-stats-badges">
                    <span class="detail-badge power-badge">Сила: ${card.power}⚔️</span>
                    ${card.ability !== 'none' ? `<span class="detail-badge hero-badge">Здібність: ${card.ability.toUpperCase()}</span>` : ''}
                </div>
            </div>
        `;

        document.getElementById('card-details-modal').classList.add('active');
    },

    closeCardDetailsModal() {
        document.getElementById('card-details-modal').classList.remove('active');
    },

    // 7. WEB AUDIO API SYNTHESIZER
    initAudio() {
        if (this.audioContext) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();
    },

    toggleAudio() {
        this.initAudio();
        
        if (this.isAudioOn) {
            this.stopBackgroundDrone();
            this.isAudioOn = false;
            document.getElementById('audio-icon').innerText = '🔇';
            document.getElementById('audio-label').innerText = 'Звук вимк.';
        } else {
            this.startBackgroundDrone();
            this.isAudioOn = true;
            document.getElementById('audio-icon').innerText = '🔊';
            document.getElementById('audio-label').innerText = 'Звук увімк.';
            this.playWinMelody(); // friendly intro sound
        }
    },

    playClickSound() {
        if (!this.isAudioOn || !this.audioContext) return;

        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    },

    playWinMelody() {
        if (!this.isAudioOn || !this.audioContext) return;

        const ctx = this.audioContext;
        const playNote = (freq, startOffset, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

            gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + startOffset + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + startOffset);
            osc.stop(ctx.currentTime + startOffset + duration);
        };

        // Arpeggio chord C Major
        playNote(261.63, 0, 0.4);   // C4
        playNote(329.63, 0.1, 0.4); // E4
        playNote(392.00, 0.2, 0.4); // G4
        playNote(523.25, 0.3, 0.7); // C5
    },

    playLoseMelody() {
        if (!this.isAudioOn || !this.audioContext) return;

        const ctx = this.audioContext;
        const playNote = (freq, startOffset, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

            gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startOffset + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + startOffset);
            osc.stop(ctx.currentTime + startOffset + duration);
        };

        // Sad minor descending tone
        playNote(220.00, 0, 0.4);   // A3
        playNote(207.65, 0.2, 0.4); // G#3
        playNote(174.61, 0.4, 0.8); // F3
    },

    startBackgroundDrone() {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        
        // Low warm ambient synth pad using Web Audio oscillators
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.value = 110; // A2
        
        osc2.type = 'sine';
        osc2.frequency.value = 165; // E3 (fifth)

        filter.type = 'lowpass';
        filter.frequency.value = 350;
        filter.Q.value = 1.0;

        gain.gain.setValueAtTime(0.08, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        this.backgroundDrone = { osc1, osc2, gain };
    },

    stopBackgroundDrone() {
        if (this.backgroundDrone) {
            try {
                this.backgroundDrone.osc1.stop();
                this.backgroundDrone.osc2.stop();
            } catch(e) {}
            this.backgroundDrone = null;
        }
    }
};

// Explicitly attach APP to the window object for global availability
window.APP = APP;

// Initialize App on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    APP.init();
});
