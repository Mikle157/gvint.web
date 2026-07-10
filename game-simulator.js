// Локальні заглушки замість хмарного модуля Firebase Realtime Database
const getDatabase = () => ({});
const ref = () => ({});
const set = () => Promise.resolve();
const onValue = () => {};
const update = () => Promise.resolve();

const GAME_SIMULATOR = {
    state: null,
    onFinished: null,
    currentMatchId: null,
    isOnline: false,
    isHost: false,

    startGame(player, opponent, onFinished, matchId = null) {
        this.onFinished = onFinished;
        this.currentMatchId = matchId;
        this.isOnline = false; // Перемикаємо в стабільний офлайн-режим для XAMPP
        this.isHost = true;

        console.log(`Бій розпочато! ${player.name} проти ${opponent.name}`);
        
        // Твоя оригінальна логіка генерації колоди та роздачі карт
        const playerDeck = this.generateFactionDeck(player.faction || 'realms');
        const opponentDeck = this.generateFactionDeck(opponent.faction || 'monsters');
        const playerHand = this.drawCards(playerDeck, 10);
        const opponentHand = this.drawCards(opponentDeck, 10);

        this.state = {
            player,
            opponent,
            playerDeck,
            opponentDeck,
            playerHand,
            opponentHand,
            playerBoard: { close: [], ranged: [], siege: [] },
            opponentBoard: { close: [], ranged: [], siege: [] },
            playerScore: { close: 0, ranged: 0, siege: 0, total: 0 },
            opponentScore: { close: 0, ranged: 0, siege: 0, total: 0 },
            playerRoundsWon: 0,
            opponentRoundsWon: 0,
            currentRound: 1,
            turn: 'player',
            playerPassed: false,
            opponentPassed: false,
            logs: ['Гравці взяли по 10 карт. Кубик кинуто! Раунд 1 почався.']
        };

        this.renderGame();
    },

    generateFactionDeck(faction) {
        // Беремо карти з gwent-cards.js
        const base = window.GWENT_CARDS?.neutral || [];
        const factionCards = window.GWENT_CARDS?.[faction] || [];
        return [...base, ...factionCards].sort(() => Math.random() - 0.5);
    },

    drawCards(deck, count) {
        return deck.splice(0, count);
    },

    renderGame() {
        const container = document.getElementById('dynamic-view-loader');
        if (!container) return;

        // Повністю відновлюємо твою візуальну бойову арену
        container.innerHTML = `
            <div class="arena-wrapper">
                <div class="battlefield">
                    <div class="board-lane enemy-lane">
                        <h3>Поле суперника: ${this.state.opponent.name} (Очки: ${this.state.opponentScore.total})</h3>
                        <p>Рундів виграно: ${this.state.opponentRoundsWon}</p>
                    </div>
                    <div class="board-lane player-lane">
                        <h3>Твоє поле: ${this.state.player.name} (Очки: ${this.state.playerScore.total})</h3>
                        <p>Рундів виграно: ${this.state.playerRoundsWon}</p>
                    </div>
                </div>
                <div class="game-battle-log" style="margin-top:20px; background:rgba(0,0,0,0.5); padding:15px; border-radius:5px;">
                    <h3 style="color:var(--gold);">Бортовий журнал бою</h3>
                    <div style="max-height:150px; overflow-y:auto;">
                        ${this.state.logs.map(log => `<div>${log}</div>`).reverse().join('')}
                    </div>
                </div>
                <button class="btn btn-accent" style="margin-top:15px;" onclick="window.location.hash='#dashboard'">Повернутись у таверну</button>
            </div>
        `;
    }
};

window.GAME_SIMULATOR = GAME_SIMULATOR;