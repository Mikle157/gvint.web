const GAME_SIMULATOR = {
    state: null,
    onFinished: null,

    // Start a new game
    startGame(player, opponent, onFinished) {
        this.onFinished = onFinished;
        
        // Assemble deck for player and opponent based on their faction
        const playerDeck = this.generateFactionDeck(player.faction);
        const opponentDeck = this.generateFactionDeck(opponent.faction);

        // Draw 10 starting cards
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
            playerPassed: false,
            opponentPassed: false,
            playerRoundsWon: 0,
            opponentRoundsWon: 0,
            weather: { frost: false, fog: false, rain: false },
            playerSpecial: { close: false, ranged: false, siege: false },
            opponentSpecial: { close: false, ranged: false, siege: false },
            playerScore: { total: 0, close: 0, ranged: 0, siege: 0 },
            opponentScore: { total: 0, close: 0, ranged: 0, siege: 0 },
            playerLeaderUsed: false,
            opponentLeaderUsed: false,
            turn: player.faction === 'scoiatael' ? 'player' : (opponent.faction === 'scoiatael' ? 'opponent' : (Math.random() > 0.5 ? 'player' : 'opponent')),
            roundIndex: 1,
            grave: { player: [], opponent: [] },
            logs: []
        };

        this.logMessage(`Бій розпочато! Погода ясна. Першим ходить: ${this.state.turn === 'player' ? player.name : opponent.name}`);
        this.recalculateScores();
        this.renderGame();

        if (this.state.turn === 'opponent') {
            setTimeout(() => this.botPlay(), 1200);
        }
    },

    generateFactionDeck(faction) {
        const deck = [];
        const neutralPool = [...window.GWENT_CARDS.neutral];
        const factionPool = [...(window.GWENT_CARDS[faction] || [])];

        // Ensure we separate unit cards from leaders
        const factionUnits = factionPool.filter(c => c.type !== 'leader');
        const neutralUnits = neutralPool.filter(c => c.type !== 'leader');

        // Select leader
        const leader = factionPool.find(c => c.type === 'leader');

        // Add 15 cards (random mix of faction units and neutrals)
        const allAvailable = [...factionUnits, ...neutralUnits];
        // Shuffle and take 15
        allAvailable.sort(() => Math.random() - 0.5);
        
        return allAvailable.slice(0, 15);
    },

    drawCards(deck, count) {
        const hand = [];
        for (let i = 0; i < count; i++) {
            if (deck.length > 0) {
                hand.push(deck.pop());
            }
        }
        return hand;
    },

    logMessage(msg) {
        this.state.logs.push(msg);
        if (this.state.logs.length > 15) this.state.logs.shift();
    },

    // Recalculate point values for each row and player
    recalculateScores() {
        const calcSideScore = (board, specialRows, isPlayerSide) => {
            const scores = { close: 0, ranged: 0, siege: 0, total: 0 };
            const faction = isPlayerSide ? this.state.player.faction : this.state.opponent.faction;
            
            // Loop through each row
            ['close', 'ranged', 'siege'].forEach(row => {
                let rowCards = board[row];
                let rowSum = 0;

                // Count tight bonds
                const cardCounts = {};
                rowCards.forEach(c => {
                    if (c.ability === 'bond' || c.ability === 'tight_bond') {
                        cardCounts[c.id] = (cardCounts[c.id] || 0) + 1;
                    }
                });

                // Moral boost counters
                let moraleBoost = 0;
                rowCards.forEach(c => {
                    if (c.ability === 'morale' || c.ability === 'hero_morale' || c.id === 'olaf') {
                        moraleBoost += 1;
                    }
                });

                rowCards.forEach(c => {
                    let cardPower = c.power;

                    // If it is NOT a hero, weather effects reduce power to 1
                    const isWeathered = (row === 'close' && this.state.weather.frost) ||
                                        (row === 'ranged' && this.state.weather.fog) ||
                                        (row === 'siege' && this.state.weather.rain);

                    // King Bran leader ability: Skellige units lose only half strength under weather
                    if (isWeathered && c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster') {
                        if (faction === 'skellige') {
                            cardPower = Math.ceil(cardPower / 2);
                        } else {
                            cardPower = 1;
                        }
                    }

                    // Tight Bond (pairs double strength)
                    if ((c.ability === 'bond' || c.ability === 'tight_bond') && cardCounts[c.id] > 1) {
                        cardPower = cardPower * cardCounts[c.id];
                    }

                    // Morale Boost (adds +1 to other cards in the row)
                    if (c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster') {
                        // Apply morale boost if there is another card with morale
                        let activeBoost = moraleBoost;
                        // Card doesn't boost itself
                        if (c.ability === 'morale' || c.id === 'olaf') {
                            activeBoost -= 1;
                        }
                        cardPower += Math.max(0, activeBoost);
                    }

                    // Commander's horn in the row or special horn card
                    const hasHorn = specialRows[row] || rowCards.some(unit => unit.ability === 'horn' || unit.id === 'dandelion');
                    if (hasHorn && c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster') {
                        cardPower = cardPower * 2;
                    }

                    rowSum += cardPower;
                });

                scores[row] = rowSum;
            });

            scores.total = scores.close + scores.ranged + scores.siege;
            return scores;
        };

        this.state.playerScore = calcSideScore(this.state.playerBoard, this.state.playerSpecial, true);
        this.state.opponentScore = calcSideScore(this.state.opponentBoard, this.state.opponentSpecial, false);
    },

    // Play card from hand
    playCard(cardIndex, targetRow) {
        if (this.state.turn !== 'player' || this.state.playerPassed) return;

        const card = this.state.playerHand[cardIndex];
        this.state.playerHand.splice(cardIndex, 1);

        this.executeCardPlacement(card, 'player', targetRow);
        
        this.recalculateScores();
        
        // Switch turn
        if (!this.state.opponentPassed) {
            this.state.turn = 'opponent';
            this.renderGame();
            setTimeout(() => this.botPlay(), 1200);
        } else {
            this.state.turn = 'player';
            this.renderGame();
        }
    },

    // Place card, process special abilities
    executeCardPlacement(card, side, targetRow) {
        const board = side === 'player' ? this.state.playerBoard : this.state.opponentBoard;
        const opponentBoard = side === 'player' ? this.state.opponentBoard : this.state.playerBoard;
        const hand = side === 'player' ? this.state.playerHand : this.state.opponentHand;
        const deck = side === 'player' ? this.state.playerDeck : this.state.opponentDeck;
        const specials = side === 'player' ? this.state.playerSpecial : this.state.opponentSpecial;

        this.logMessage(`${side === 'player' ? this.state.player.name : this.state.opponent.name} грає: ${card.name} (${card.power}⚔️)`);

        // Check specials
        if (card.ability === 'horn_special') {
            // Apply commander horn to row
            const rowToApply = targetRow || 'close';
            specials[rowToApply] = true;
            return;
        }

        if (card.ability === 'scorch') {
            this.executeScorch();
            return;
        }

        if (card.ability === 'decoy') {
            // Decoy swaps with a non-hero unit on player board
            // Let the simulator auto-swap or simulate
            const rowToSwap = targetRow || 'close';
            if (board[rowToSwap].length > 0) {
                // Find a non-hero card
                const swappableIdx = board[rowToSwap].findIndex(c => c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster');
                if (swappableIdx !== -1) {
                    const swapped = board[rowToSwap][swappableIdx];
                    board[rowToSwap].splice(swappableIdx, 1);
                    hand.push(swapped);
                    this.logMessage(`Опудало повернуло ${swapped.name} у руку.`);
                }
            }
            return;
        }

        // Determine destination row based on card properties
        let destRow = card.type;
        if (destRow === 'special') destRow = 'close'; // fallback

        // Weather effects
        if (card.ability === 'weather_frost') this.state.weather.frost = true;
        if (card.ability === 'weather_fog') this.state.weather.fog = true;
        if (card.ability === 'weather_rain') this.state.weather.rain = true;

        // Spy ability: goes to opponent's board, draws 2 cards
        if (card.ability === 'spy') {
            opponentBoard[destRow].push(card);
            this.drawCards(deck, 2).forEach(c => hand.push(c));
            this.logMessage(`Шпигун! Взято 2 додаткові карти.`);
            return;
        }

        // Muster ability: find all other copies of same card in deck and play them
        if (card.ability === 'muster') {
            board[destRow].push(card);
            const copies = deck.filter(c => c.id === card.id);
            copies.forEach(c => {
                board[destRow].push(c);
                this.logMessage(`Збір! Прикликано копію: ${c.name}`);
            });
            // remove from deck
            side === 'player' 
                ? this.state.playerDeck = deck.filter(c => c.id !== card.id)
                : this.state.opponentDeck = deck.filter(c => c.id !== card.id);
            return;
        }

        // Medic ability: revive one card from grave (if any)
        if (card.ability === 'medic') {
            board[destRow].push(card);
            const grave = side === 'player' ? this.state.grave.player : this.state.grave.opponent;
            const revivePool = grave.filter(c => c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster' && c.type !== 'special');
            if (revivePool.length > 0) {
                const revivedCard = revivePool[Math.floor(Math.random() * revivePool.length)];
                // Remove from grave
                const graveIdx = grave.findIndex(c => c.id === revivedCard.id);
                grave.splice(graveIdx, 1);
                
                // Play it
                this.executeCardPlacement(revivedCard, side, revivedCard.type);
            }
            return;
        }

        // Default placement
        board[destRow].push(card);
    },

    executeScorch() {
        let maxPower = -1;
        let targets = [];

        // Find max power on both sides (non-heroes only)
        const checkRows = (board, side) => {
            ['close', 'ranged', 'siege'].forEach(row => {
                board[row].forEach(c => {
                    if (c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster' && c.power > maxPower) {
                        maxPower = c.power;
                    }
                });
            });
        };

        checkRows(this.state.playerBoard, 'player');
        checkRows(this.state.opponentBoard, 'opponent');

        if (maxPower <= 0) {
            this.logMessage(`Казнь не знайшла гідних цілей.`);
            return;
        }

        // Collect and remove targets
        const removeTargets = (board, side, grave) => {
            ['close', 'ranged', 'siege'].forEach(row => {
                const survivors = [];
                board[row].forEach(c => {
                    if (c.power === maxPower && c.ability !== 'hero' && c.ability !== 'hero_morale' && c.ability !== 'hero_muster') {
                        grave.push(c);
                        this.logMessage(`Знищено карту: ${c.name} (${c.power}⚔️)`);
                    } else {
                        survivors.push(c);
                    }
                });
                board[row] = survivors;
            });
        };

        removeTargets(this.state.playerBoard, 'player', this.state.grave.player);
        removeTargets(this.state.opponentBoard, 'opponent', this.state.grave.opponent);
    },

    // Pass turn
    pass(side) {
        if (side === 'player') {
            this.state.playerPassed = true;
            this.logMessage(`${this.state.player.name} пасує.`);
            this.state.turn = 'opponent';
        } else {
            this.state.opponentPassed = true;
            this.logMessage(`${this.state.opponent.name} пасує.`);
            this.state.turn = 'player';
        }

        this.recalculateScores();

        // Check if both passed
        if (this.state.playerPassed && this.state.opponentPassed) {
            this.resolveRound();
        } else if (side === 'player' && !this.state.opponentPassed) {
            // Keep simulating bot until it passes
            setTimeout(() => this.botPlay(), 1000);
        } else {
            this.renderGame();
        }
    },

    // Bot AI Logic
    botPlay() {
        if (this.state.opponentPassed) return;

        const hand = this.state.opponentHand;
        const playerScore = this.state.playerScore.total;
        const botScore = this.state.opponentScore.total;

        // If player passed, bot decides whether to pass or play
        if (this.state.playerPassed) {
            if (botScore > playerScore) {
                // Already winning, pass to save cards
                this.pass('opponent');
                return;
            }
            if (hand.length === 0) {
                this.pass('opponent');
                return;
            }
        } else {
            // Player hasn't passed
            if (hand.length === 0) {
                this.pass('opponent');
                return;
            }
            
            // If bot is significantly ahead, or has very few cards, might pass
            if (botScore > playerScore + 15 && Math.random() > 0.6) {
                this.pass('opponent');
                return;
            }
        }

        // Check if bot wants to use leader ability
        if (!this.state.opponentLeaderUsed && Math.random() > 0.5) {
            const faction = this.state.opponent.faction;
            let shouldUse = false;

            if (faction === 'realms') {
                if (this.state.weather.frost || this.state.weather.fog || this.state.weather.rain) {
                    shouldUse = true;
                }
            } else if (faction === 'monsters') {
                if (this.state.opponentBoard.close.length >= 2 && !this.state.opponentSpecial.close) {
                    shouldUse = true;
                }
            } else if (faction === 'scoiatael') {
                if (hand.length < 5) {
                    shouldUse = true;
                }
            } else if (faction === 'nilfgaard') {
                if (this.state.roundIndex === 1 && hand.length >= 8) {
                    shouldUse = true;
                }
            }

            if (shouldUse) {
                this.useLeaderAbility('opponent');
                return;
            }
        }

        // Choose a card to play
        // Bot plays lower value units first, or special cards if conditions met
        let cardIdx = 0;
        // Sort hand: specials and high values later
        const sortedHandWithIdx = hand.map((card, idx) => ({ card, idx }))
            .sort((a, b) => a.card.power - b.card.power);

        // Simple strategy: play card
        const choice = sortedHandWithIdx[0];
        hand.splice(choice.idx, 1);

        this.executeCardPlacement(choice.card, 'opponent');
        this.recalculateScores();

        // Switch turn
        if (!this.state.playerPassed) {
            this.state.turn = 'player';
            this.renderGame();
        } else {
            this.state.turn = 'opponent';
            this.renderGame();
            setTimeout(() => this.botPlay(), 1200);
        }
    },

    // Resolve round, determine winner, clear board
    resolveRound() {
        const pScore = this.state.playerScore.total;
        const oScore = this.state.opponentScore.total;

        this.logMessage(`Кінець раунду ${this.state.roundIndex}! Рахунок: ${pScore} проти ${oScore}`);

        let winner = null;
        if (pScore > oScore) {
            winner = 'player';
            this.state.playerRoundsWon += 1;
            this.logMessage(`Раунд виграв: ${this.state.player.name}`);
        } else if (oScore > pScore) {
            winner = 'opponent';
            this.state.opponentRoundsWon += 1;
            this.logMessage(`Раунд виграв: ${this.state.opponent.name}`);
        } else {
            // Draw
            // Nilfgaard faction ability: wins ties
            if (this.state.player.faction === 'nilfgaard' && this.state.opponent.faction !== 'nilfgaard') {
                winner = 'player';
                this.state.playerRoundsWon += 1;
                this.logMessage(`Нільфгаардська зверхність! Нічия на користь ${this.state.player.name}`);
            } else if (this.state.opponent.faction === 'nilfgaard' && this.state.player.faction !== 'nilfgaard') {
                winner = 'opponent';
                this.state.opponentRoundsWon += 1;
                this.logMessage(`Нільфгаардська зверхність! Нічия на користь ${this.state.opponent.name}`);
            } else {
                // Both get a point
                this.state.playerRoundsWon += 1;
                this.state.opponentRoundsWon += 1;
                this.logMessage(`Нічия! Обидва суперники отримують по рубіну.`);
            }
        }

        // Faction abilities on round end:
        // Realms: draws 1 card on round win
        if (winner === 'player' && this.state.player.faction === 'realms') {
            this.drawCards(this.state.playerDeck, 1).forEach(c => this.state.playerHand.push(c));
            this.logMessage(`Королівства Півночі: отримано додаткову карту за перемогу.`);
        }
        if (winner === 'opponent' && this.state.opponent.faction === 'realms') {
            this.drawCards(this.state.opponentDeck, 1).forEach(c => this.state.opponentHand.push(c));
            this.logMessage(`Королівства Півночі: бот отримав додаткову карту за перемогу.`);
        }

        // Monsters: keeps 1 random card on the board (others go to grave)
        const clearBoardWithMonsterAbility = (board, faction, grave) => {
            let keepCard = null;
            let keepRow = null;

            if (faction === 'monsters') {
                const allUnits = [];
                ['close', 'ranged', 'siege'].forEach(row => {
                    board[row].forEach(c => {
                        allUnits.push({ card: c, row });
                    });
                });
                if (allUnits.length > 0) {
                    const chosen = allUnits[Math.floor(Math.random() * allUnits.length)];
                    keepCard = chosen.card;
                    keepRow = chosen.row;
                    this.logMessage(`Монстри залишають на столі: ${keepCard.name}`);
                }
            }

            ['close', 'ranged', 'siege'].forEach(row => {
                board[row].forEach(c => {
                    if (c !== keepCard) {
                        grave.push(c);
                    }
                });
                board[row] = (keepCard && keepRow === row) ? [keepCard] : [];
            });
        };

        clearBoardWithMonsterAbility(this.state.playerBoard, this.state.player.faction, this.state.grave.player);
        clearBoardWithMonsterAbility(this.state.opponentBoard, this.state.opponent.faction, this.state.grave.opponent);

        // Skellige faction ability: at start of round 3, return 2 random cards from grave to field
        if (this.state.roundIndex === 2) {
            const triggerSkelligeGrave = (grave, board, faction) => {
                if (faction === 'skellige' && grave.length > 0) {
                    const units = grave.filter(c => c.type !== 'special' && c.ability !== 'hero');
                    units.sort(() => Math.random() - 0.5);
                    const revived = units.slice(0, 2);
                    revived.forEach(c => {
                        board[c.type].push(c);
                        const idx = grave.findIndex(x => x.id === c.id);
                        if (idx !== -1) grave.splice(idx, 1);
                        this.logMessage(`Скелліге повертає з відбою: ${c.name}`);
                    });
                }
            };
            triggerSkelligeGrave(this.state.grave.player, this.state.playerBoard, this.state.player.faction);
            triggerSkelligeGrave(this.state.grave.opponent, this.state.opponentBoard, this.state.opponent.faction);
        }

        // Reset round pass statuses, horns, weather
        this.state.playerPassed = false;
        this.state.opponentPassed = false;
        this.state.weather = { frost: false, fog: false, rain: false };
        this.state.playerSpecial = { close: false, ranged: false, siege: false };
        this.state.opponentSpecial = { close: false, ranged: false, siege: false };

        this.state.roundIndex += 1;
        this.recalculateScores();

        // Check match winner
        const pWin = this.state.playerRoundsWon >= 2;
        const oWin = this.state.opponentRoundsWon >= 2;

        if (pWin || oWin) {
            let finalWinner = null;
            if (pWin && oWin) {
                // If both reach 2 due to draw, player with higher total cumulative score wins, or coin toss
                finalWinner = this.state.playerScore.total >= this.state.opponentScore.total ? 'player' : 'opponent';
            } else {
                finalWinner = pWin ? 'player' : 'opponent';
            }

            const winnerName = finalWinner === 'player' ? this.state.player.name : this.state.opponent.name;
            this.logMessage(`Гру завершено! Переможець матчу: ${winnerName} 🎉`);
            this.renderGame();

            setTimeout(() => {
                if (this.onFinished) {
                    this.onFinished(finalWinner === 'player' ? this.state.player.id : this.state.opponent.id);
                }
            }, 3000);
        } else {
            // Next round
            // Winner of previous round starts
            this.state.turn = winner === 'player' ? 'player' : 'opponent';
            this.renderGame();
            if (this.state.turn === 'opponent') {
                setTimeout(() => this.botPlay(), 1200);
            }
        }
    },

    // Render game board UI
    renderGame() {
        const boardEl = document.getElementById('gwent-board-container');
        if (!boardEl) return;

        // Factions emblem
        const pFaction = window.GWENT_FACTIONS[this.state.player.faction];
        const oFaction = window.GWENT_FACTIONS[this.state.opponent.faction];

        let weatherHTML = '';
        if (this.state.weather.frost) weatherHTML += `<div class="weather-badge frost">Мороз ❄️</div>`;
        if (this.state.weather.fog) weatherHTML += `<div class="weather-badge fog">Імла 🌫️</div>`;
        if (this.state.weather.rain) weatherHTML += `<div class="weather-badge rain">Злива 🌧️</div>`;
        if (!weatherHTML) weatherHTML = '<div class="weather-badge clear">Ясно ☀️</div>';

        // Gems/Rubies won visual
        const getGemHTML = (count) => {
            let gems = '';
            for (let i = 0; i < 2; i++) {
                if (i < count) {
                    gems += '<span class="ruby active">♦</span>';
                } else {
                    gems += '<span class="ruby">♢</span>';
                }
            }
            return gems;
        };

        const renderCardList = (cards, isInteractive, side) => {
            return cards.map((c, idx) => {
                const cardClass = `gwent-card-item ${c.ability || 'none'} ${c.type === 'special' ? 'special' : ''}`;
                const interactiveAttr = isInteractive ? `onclick="GAME_SIMULATOR.playCard(${idx})"` : '';
                return `
                    <div class="${cardClass}" ${interactiveAttr} title="${c.desc || ''}">
                        <div class="card-power">${c.type !== 'special' ? c.power : ''}</div>
                        <div class="card-icon">${c.image || '⚔️'}</div>
                        <div class="card-title">${c.name}</div>
                        <div class="card-ability-indicator">${c.ability !== 'none' ? c.ability.toUpperCase() : ''}</div>
                    </div>
                `;
            }).join('');
        };

        const renderRowCards = (cards) => {
            return cards.map(c => `
                <div class="gwent-card-mini ${c.ability || 'none'}" title="${c.name}: ${c.desc || ''}">
                    <div class="mini-power">${c.power}</div>
                    <div class="mini-icon">${c.image}</div>
                </div>
            `).join('');
        };

        boardEl.innerHTML = `
            <div class="gwent-game-layout">
                <!-- Left Sidebar: Score & Info -->
                <div class="game-sidebar">
                    <div class="sidebar-faction opponent-faction-header" style="border-left: 5px solid ${oFaction.themeColor}">
                        <div class="faction-avatar">${oFaction.emblem}</div>
                        <div class="faction-player-info">
                            <span class="player-label">${this.state.opponent.name}</span>
                            <span class="faction-label">${oFaction.name}</span>
                        </div>
                        <div class="faction-rubies">${getGemHTML(this.state.opponentRoundsWon)}</div>
                        <div class="faction-cards-count">Карток: ${this.state.opponentHand.length} 🎴</div>
                        <div class="faction-score-total">${this.state.opponentScore.total}</div>
                        ${this.state.opponentPassed ? '<div class="passed-badge">ПАСУВАВ</div>' : ''}

                        <div class="leader-card-wrapper">
                            <div class="leader-card ${this.state.opponentLeaderUsed ? 'used' : ''}" 
                                 title="Здібність: ${window.GWENT_CARDS[this.state.opponent.faction]?.find(c => c.type === 'leader')?.desc || ''}">
                                <span class="leader-card-title">ЛІДЕР</span>
                                <span class="leader-card-icon">👑</span>
                                <span style="font-size:0.65rem; font-weight:700; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${window.GWENT_CARDS[this.state.opponent.faction]?.find(c => c.type === 'leader')?.name || 'Лідер'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="weather-panel-display">
                        <h4>Погода на полі</h4>
                        <div class="weather-badges-container">${weatherHTML}</div>
                        <div class="round-counter-display">Раунд ${this.state.roundIndex}</div>
                    </div>

                    <div class="sidebar-faction player-faction-header" style="border-left: 5px solid ${pFaction.themeColor}">
                        <div class="faction-avatar">${pFaction.emblem}</div>
                        <div class="faction-player-info">
                            <span class="player-label">${this.state.player.name}</span>
                            <span class="faction-label">${pFaction.name}</span>
                        </div>
                        <div class="faction-rubies">${getGemHTML(this.state.playerRoundsWon)}</div>
                        <div class="faction-cards-count">Карток: ${this.state.playerHand.length} 🎴</div>
                        <div class="faction-score-total">${this.state.playerScore.total}</div>
                        ${this.state.playerPassed ? '<div class="passed-badge">ПАСУВАВ</div>' : ''}

                        <div class="leader-card-wrapper">
                            <div class="leader-card ${this.state.playerLeaderUsed ? 'used' : ''}" 
                                 onclick="if (!GAME_SIMULATOR.state.playerLeaderUsed && GAME_SIMULATOR.state.turn === 'player' && !GAME_SIMULATOR.state.playerPassed) GAME_SIMULATOR.useLeaderAbility('player')" 
                                 title="Здібність: ${window.GWENT_CARDS[this.state.player.faction]?.find(c => c.type === 'leader')?.desc || ''}">
                                <span class="leader-card-title">ЛІДЕР</span>
                                <span class="leader-card-icon">👑</span>
                                <span style="font-size:0.65rem; font-weight:700; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${window.GWENT_CARDS[this.state.player.faction]?.find(c => c.type === 'leader')?.name || 'Лідер'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="action-controls">
                        <button class="btn btn-accent" id="btn-player-pass" onclick="GAME_SIMULATOR.pass('player')" ${this.state.playerPassed || this.state.turn !== 'player' ? 'disabled' : ''}>Пасувати</button>
                    </div>
                </div>

                <!-- Center: Board Lanes -->
                <div class="game-board-lanes">
                    <!-- OPPONENT LANES -->
                    <div class="board-lane opponent-siege-lane">
                        <div class="lane-icon-column">☄️ <span class="lane-score">${this.state.opponentScore.siege}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.opponentBoard.siege)}</div>
                    </div>
                    <div class="board-lane opponent-ranged-lane">
                        <div class="lane-icon-column">🏹 <span class="lane-score">${this.state.opponentScore.ranged}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.opponentBoard.ranged)}</div>
                    </div>
                    <div class="board-lane opponent-close-lane">
                        <div class="lane-icon-column">⚔️ <span class="lane-score">${this.state.opponentScore.close}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.opponentBoard.close)}</div>
                    </div>

                    <div class="board-divider-line"></div>

                    <!-- PLAYER LANES -->
                    <div class="board-lane player-close-lane">
                        <div class="lane-icon-column">⚔️ <span class="lane-score">${this.state.playerScore.close}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.playerBoard.close)}</div>
                    </div>
                    <div class="board-lane player-ranged-lane">
                        <div class="lane-icon-column">🏹 <span class="lane-score">${this.state.playerScore.ranged}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.playerBoard.ranged)}</div>
                    </div>
                    <div class="board-lane player-siege-lane">
                        <div class="lane-icon-column">☄️ <span class="lane-score">${this.state.playerScore.siege}</span></div>
                        <div class="lane-cards-row">${renderRowCards(this.state.playerBoard.siege)}</div>
                    </div>
                </div>

                <!-- Right: Logs -->
                <div class="game-battle-log">
                    <h3>Бортовий журнал</h3>
                    <div class="log-messages-container">
                        ${this.state.logs.map(log => `<div class="log-line">${log}</div>`).reverse().join('')}
                    </div>
                </div>
            </div>

            <!-- Player Hand -->
            <div class="player-hand-container">
                <h3>Ваша рука (Оберіть карту для ходу)</h3>
                <div class="player-hand-scroll-row">
                    ${this.state.playerHand.length === 0 ? '<div class="empty-hand-msg">У вас не залишилося карт. Ви повинні пасувати.</div>' : renderCardList(this.state.playerHand, this.state.turn === 'player' && !this.state.playerPassed, 'player')}
                </div>
            </div>
        `;
    },

    // --- LEADER CARD ABILITY HANDLERS ---
    useLeaderAbility(side) {
        if (side === 'player') {
            if (this.state.playerLeaderUsed || this.state.turn !== 'player' || this.state.playerPassed) return;
            this.state.playerLeaderUsed = true;
            this.executeLeaderEffect('player', this.state.player.faction);
            this.recalculateScores();
            
            this.logMessage(`${this.state.player.name} використовує силу Лідера!`);

            // Switch turn if opponent hasn't passed
            if (!this.state.opponentPassed) {
                this.state.turn = 'opponent';
                this.renderGame();
                setTimeout(() => this.botPlay(), 1200);
            } else {
                this.renderGame();
            }
        } else {
            if (this.state.opponentLeaderUsed || this.state.opponentPassed) return;
            this.state.opponentLeaderUsed = true;
            this.executeLeaderEffect('opponent', this.state.opponent.faction);
            this.recalculateScores();
            
            this.logMessage(`${this.state.opponent.name} використовує силу Лідера!`);

            if (!this.state.playerPassed) {
                this.state.turn = 'player';
                this.renderGame();
            } else {
                this.renderGame();
                setTimeout(() => this.botPlay(), 1200);
            }
        }
    },

    executeLeaderEffect(side, faction) {
        const board = side === 'player' ? this.state.playerBoard : this.state.opponentBoard;
        const hand = side === 'player' ? this.state.playerHand : this.state.opponentHand;
        const deck = side === 'player' ? this.state.playerDeck : this.state.opponentDeck;
        const specials = side === 'player' ? this.state.playerSpecial : this.state.opponentSpecial;

        if (faction === 'realms') {
            this.state.weather = { frost: false, fog: false, rain: false };
            this.logMessage(`Лідер очистив погодні ефекти.`);
        } 
        else if (faction === 'monsters') {
            specials.close = true;
            this.logMessage(`Лідер подвоїв силу рукопашного ряду.`);
        } 
        else if (faction === 'scoiatael') {
            const drawn = this.drawCards(deck, 1);
            drawn.forEach(c => hand.push(c));
            this.logMessage(`Лідер дозволив взяти додаткову карту.`);
        } 
        else if (faction === 'nilfgaard') {
            const oppHand = side === 'player' ? this.state.opponentHand : this.state.playerHand;
            if (side === 'player') {
                const randomCards = [...oppHand].sort(() => Math.random() - 0.5).slice(0, 3);
                if (randomCards.length > 0) {
                    const cardsDesc = randomCards.map(c => `[${c.name} (Сила: ${c.power})]`).join(', ');
                    alert(`Шпигуни Нільфгаарду виявили карти суперника: ${cardsDesc}`);
                } else {
                    alert(`У руці суперника немає карт.`);
                }
            } else {
                this.logMessage(`Опонент заглянув у вашу руку.`);
            }
        }
        else if (faction === 'skellige') {
            this.logMessage(`Активується міць Скелліге.`);
        }
    }
};

if (typeof window !== 'undefined') {
    window.GAME_SIMULATOR = GAME_SIMULATOR;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_SIMULATOR };
}
