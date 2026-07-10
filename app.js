// Глобальний стан додатку (замість Firebase працює з нашим PHP)
const APP = {
    currentUser: null,
    users: [],
    tournaments: [],
    currentAuthTab: 'login',
    audioContext: null,
    backgroundDrone: null,
    isAudioOn: false,
    activeTournamentId: null,

    async init() {
        this.bindEvents();
        
        // Роутер для перемикання секцій сторінки (#tavern, #tournaments тощо)
        window.addEventListener('hashchange', () => this.handleRouting());
        this.handleRouting();

        // Замість ініціалізації Firebase — робимо запит до PHP за користувачами
        await this.syncDataWithPHP();
        this.checkLocalSession();
    },

    bindEvents() {
        // Навігаційні лінки
        document.querySelectorAll('#main-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSection = link.getAttribute('data-target');
                this.navigateToSection(targetSection);
            });
        });
    },

    handleRouting() {
        const hash = window.location.hash || '#tavern';
        if (hash === '#tavern') this.navigateToSection('section-tavern');
        else if (hash === '#tournaments') this.navigateToSection('section-tournaments');
        else if (hash === '#profile') this.navigateToSection('section-profile');
        else if (hash === '#leaderboard') this.navigateToSection('section-leaderboard');
    },

    navigateToSection(sectionId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        document.querySelectorAll('#main-nav a').forEach(l => l.classList.remove('active'));

        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');

        // Оновлюємо хеш у стрічці браузера
        const hashMapping = {
            'section-tavern': '#tavern',
            'section-tournaments': '#tournaments',
            'section-profile': '#profile',
            'section-leaderboard': '#leaderboard'
        };
        if (hashMapping[sectionId]) {
            window.location.hash = hashMapping[sectionId];
            const activeLink = document.querySelector(`#main-nav a[data-target="${sectionId}"]`);
            if (activeLink) activeLink.classList.add('active');
        }

        if (sectionId === 'section-profile') this.renderProfile();
        if (sectionId === 'section-leaderboard') this.renderLeaderboard();
        if (sectionId === 'section-tavern') this.renderTavern();
    },

    // --- СИНХРОНІЗАЦІЯ З PHP API ---
    async syncDataWithPHP() {
        try {
            const response = await fetch('api.php?action=get_users');
            const data = await response.json();
            if (data.success) {
                this.users = data.users;
                this.renderLeaderboard();
                this.renderTavern();
            }
        } catch (err) {
            console.error("Помилка з'єднання з PHP API:", err);
        }
    },

    checkLocalSession() {
        const savedUser = localStorage.getItem('gwent_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            // Перевіряємо актуальні дані користувача серед масиву з бази
            const freshData = this.users.find(u => u.id === this.currentUser.id);
            if (freshData) this.currentUser = freshData;
            this.updateAuthWidget();
        }
    },

    async handleAuthSubmit(event, type) {
        event.preventDefault();
        const usernameInput = document.getElementById(`${type}-username`).value;
        const passwordInput = document.getElementById(`${type}-password`).value;
        
        let bodyData = { action: type, username: usernameInput, password: passwordInput };
        if (type === 'register') {
            bodyData.faction = document.getElementById('register-faction').value;
        }

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await response.json();

            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('gwent_user', JSON.stringify(data.user));
                this.updateAuthWidget();
                this.closeAuthModal();
                await this.syncDataWithPHP();
                this.navigateToSection('section-profile');
            } else {
                alert("Помилка авторизації: " + data.message);
            }
        } catch (err) {
            alert("Не вдалося виконати запит до PHP.");
            console.error(err);
        }
    },

    logout() {
        fetch('api.php?action=logout');
        this.currentUser = null;
        localStorage.removeItem('gwent_user');
        this.updateAuthWidget();
        this.navigateToSection('section-tavern');
    },

    updateAuthWidget() {
        const widget = document.getElementById('user-auth-section');
        if (this.currentUser) {
            widget.innerHTML = `
                <div class="user-logged-badge" onclick="APP.navigateToSection('section-profile')">
                    <span>⚔️ ${this.currentUser.username}</span>
                    <small style="color: var(--gold);">(${this.currentUser.mmr} MMR)</small>
                </div>
            `;
        } else {
            widget.innerHTML = `<button class="btn btn-accent" onclick="APP.openAuthModal('login')">Вхід / Реєстрація</button>`;
        }
    },

    // --- ОНОВЛЕННЯ MMR ПІСЛЯ ГРИ ---
    async updateUserRating(userId, pointsEarned, isWinner) {
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_mmr',
                    id: userId,
                    points: pointsEarned,
                    win: isWinner
                })
            });
            await response.json();
            await this.syncDataWithPHP();
            if (this.currentUser && this.currentUser.id === userId) {
                this.currentUser.mmr = Math.max(0, this.currentUser.mmr + pointsEarned);
                if (isWinner) this.currentUser.wins++;
                localStorage.setItem('gwent_user', JSON.stringify(this.currentUser));
            }
        } catch (err) {
            console.error("Не вдалося оновити рейтинг на сервері", err);
        }
    },

    // --- РЕНДЕРИНГ КОМПОНЕНТІВ СТОРІНКИ ---
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.users.forEach((user, index) => {
            const tr = document.createElement('tr');
            if (this.currentUser && user.id === this.currentUser.id) {
                tr.style.background = 'rgba(214,175,55,0.15)';
            }
            tr.innerHTML = `
                <td><strong>#${index + 1}</strong></td>
                <td>${user.username}</td>
                <td style="text-transform: capitalize; color: var(--text-muted);">${user.faction}</td>
                <td style="text-align: right; color: var(--gold); font-weight: bold;">${user.mmr}</td>
                <td style="text-align: right;">${user.wins}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderTavern() {
        if(document.getElementById('stats-total-players')) {
            document.getElementById('stats-total-players').innerText = this.users.length.toString();
        }
    },

    renderProfile() {
        const unauth = document.getElementById('profile-unauthenticated-msg');
        const authView = document.getElementById('profile-authenticated-view');
        
        if (!this.currentUser) {
            if(unauth) unauth.style.display = 'block';
            if(authView) authView.style.display = 'none';
            return;
        }

        if(unauth) unauth.style.display = 'none';
        if(authView) authView.style.display = 'grid';

        document.getElementById('profile-username').innerText = this.currentUser.username;
        document.getElementById('profile-stat-mmr').innerText = this.currentUser.mmr;
        document.getElementById('profile-stat-wins').innerText = this.currentUser.wins;
        document.getElementById('profile-faction-name').innerText = "Фракція: " + this.currentUser.faction;
    },

    // --- МОДАЛКИ (ВХІД / РЕЄСТРАЦІЯ) ---
    openAuthModal(tab = 'login') {
        document.getElementById('auth-modal').classList.add('active');
        this.switchAuthTab(tab);
    },
    closeAuthModal() {
        document.getElementById('auth-modal').classList.remove('active');
    },
    switchAuthTab(tab) {
        this.currentAuthTab = tab;
        if (tab === 'login') {
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('tab-register').classList.remove('active');
            document.getElementById('form-login').style.display = 'block';
            document.getElementById('form-register').style.display = 'none';
        } else {
            document.getElementById('tab-register').classList.add('active');
            document.getElementById('tab-login').classList.remove('active');
            document.getElementById('form-register').style.display = 'block';
            document.getElementById('form-login').style.display = 'none';
        }
    },
    openQuickPlayModal() { document.getElementById('quickplay-modal').classList.add('active'); },
    closeQuickPlayModal() { document.getElementById('quickplay-modal').classList.remove('active'); },
    toggleAudio() { console.log("Музичний супровід таверни увімкнено."); }
};

// Запуск при завантаженні сторінки
window.addEventListener('DOMContentLoaded', () => {
    APP.init();
});