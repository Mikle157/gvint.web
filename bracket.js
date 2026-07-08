const BRACKET = {
    // Generate initial bracket structure for 8 players
    generateInitialBracket(players) {
        // Shuffle players
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        
        // Quarterfinals (Round 0): 4 matches
        const round0 = [];
        for (let i = 0; i < 4; i++) {
            round0.push({
                id: `r0_m${i}`,
                player1: shuffled[i * 2] || null,
                player2: shuffled[i * 2 + 1] || null,
                score1: 0,
                score2: 0,
                winnerId: null,
                status: 'pending'
            });
        }

        // Semifinals (Round 1): 2 matches
        const round1 = [
            { id: `r1_m0`, player1: null, player2: null, score1: 0, score2: 0, winnerId: null, status: 'pending' },
            { id: `r1_m1`, player1: null, player2: null, score1: 0, score2: 0, winnerId: null, status: 'pending' }
        ];

        // Finals (Round 2): 1 match
        const round2 = [
            { id: `r2_m0`, player1: null, player2: null, score1: 0, score2: 0, winnerId: null, status: 'pending' }
        ];

        return [round0, round1, round2];
    },

    // Check and update matches if bots can be simulated automatically
    simulateBotMatches(tournament, onMatchSimulated) {
        let updated = false;
        const currentUserId = window.APP ? window.APP.currentUser?.id : null;

        for (let r = 0; r < tournament.bracket.length; r++) {
            const round = tournament.bracket[r];
            for (let m = 0; m < round.length; m++) {
                const match = round[m];
                
                // If match is pending and has both players, check if they are both bots
                if (match.status === 'pending' && match.player1 && match.player2) {
                    const isP1Bot = match.player1.isBot;
                    const isP2Bot = match.player2.isBot;

                    // If both are bots (or one is bot and user is not logged in / not this player)
                    // Wait, we want to simulate matches where the user is NOT participating
                    const userInMatch = (match.player1.id === currentUserId || match.player2.id === currentUserId);

                    if (!userInMatch && (isP1Bot && isP2Bot)) {
                        // Simulate bot match
                        this.executeSimulation(match, tournament, r, m);
                        updated = true;
                        if (onMatchSimulated) onMatchSimulated(match);
                    }
                }
            }
        }
        return updated;
    },

    // Execute simulation for a single match (pure random/power based bot vs bot)
    executeSimulation(match, tournament, r, m) {
        // Give a slight advantage to higher MMR players
        const mmr1 = match.player1.mmr || 1000;
        const mmr2 = match.player2.mmr || 1000;
        
        const winChance1 = 0.5 + (mmr1 - mmr2) / 1000;
        const roll = Math.random();
        
        // Gwent matches are best of 3 rounds, so scores are usually 2-0 or 2-1
        if (roll < winChance1) {
            match.score1 = 2;
            match.score2 = Math.random() > 0.5 ? 1 : 0;
            match.winnerId = match.player1.id;
        } else {
            match.score2 = 2;
            match.score1 = Math.random() > 0.5 ? 1 : 0;
            match.winnerId = match.player2.id;
        }
        
        match.status = 'completed';

        // Advance winner to next round
        this.advanceWinner(tournament, r, m, match.winnerId);
    },

    // Advance winner of round r, match m to round r+1
    advanceWinner(tournament, r, m, winnerId) {
        const nextRoundIndex = r + 1;
        if (nextRoundIndex >= tournament.bracket.length) {
            // Tournament is over!
            tournament.winnerId = winnerId;
            tournament.status = 'completed';
            return;
        }

        const nextMatchIndex = Math.floor(m / 2);
        const isPlayer1Slot = (m % 2 === 0);
        const nextMatch = tournament.bracket[nextRoundIndex][nextMatchIndex];
        const winner = [
            ...tournament.bracket[r][m].player1 ? [tournament.bracket[r][m].player1] : [],
            ...tournament.bracket[r][m].player2 ? [tournament.bracket[r][m].player2] : []
        ].find(p => p.id === winnerId);

        if (isPlayer1Slot) {
            nextMatch.player1 = winner;
        } else {
            nextMatch.player2 = winner;
        }
    },

    // Render bracket to container
    renderBracket(containerId, tournament, onPlayMatchClick) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        const currentUserId = window.APP ? window.APP.currentUser?.id : null;

        const bracketEl = document.createElement('div');
        bracketEl.className = 'bracket-viewport';

        const roundNames = ['Чвертьфінали', 'Півфінали', 'Фінал'];

        tournament.bracket.forEach((round, rIndex) => {
            const roundCol = document.createElement('div');
            roundCol.className = `bracket-round round-${rIndex}`;

            const roundTitle = document.createElement('div');
            roundTitle.className = 'round-title';
            roundTitle.innerText = roundNames[rIndex];
            roundCol.appendChild(roundTitle);

            const matchesList = document.createElement('div');
            matchesList.className = 'round-matches';

            round.forEach((match, mIndex) => {
                const matchEl = document.createElement('div');
                matchEl.className = `bracket-match ${match.status}`;
                matchEl.dataset.matchId = match.id;
                matchEl.dataset.roundIndex = rIndex;
                matchEl.dataset.matchIndex = mIndex;

                const p1 = match.player1;
                const p2 = match.player2;

                const isUserInMatch = p1?.id === currentUserId || p2?.id === currentUserId;
                const canUserPlay = isUserInMatch && match.status === 'pending' && p1 && p2;

                // Mark player rows if they are winner
                const p1WinnerClass = match.status === 'completed' && match.winnerId === p1?.id ? 'winner' : (match.status === 'completed' ? 'loser' : '');
                const p2WinnerClass = match.status === 'completed' && match.winnerId === p2?.id ? 'winner' : (match.status === 'completed' ? 'loser' : '');

                const p1UserClass = p1?.id === currentUserId ? 'current-user' : '';
                const p2UserClass = p2?.id === currentUserId ? 'current-user' : '';

                matchEl.innerHTML = `
                    <div class="match-details">
                        <div class="match-player ${p1WinnerClass} ${p1UserClass}">
                            <span class="player-faction-icon">${p1 ? (window.GWENT_FACTIONS[p1.faction]?.emblem || '🛡️') : '❓'}</span>
                            <span class="player-name">${p1 ? p1.name : 'Очікування...'}</span>
                            <span class="player-score">${match.status === 'completed' || match.status === 'active' ? match.score1 : '-'}</span>
                        </div>
                        <div class="match-divider"></div>
                        <div class="match-player ${p2WinnerClass} ${p2UserClass}">
                            <span class="player-faction-icon">${p2 ? (window.GWENT_FACTIONS[p2.faction]?.emblem || '🛡️') : '❓'}</span>
                            <span class="player-name">${p2 ? p2.name : 'Очікування...'}</span>
                            <span class="player-score">${match.status === 'completed' || match.status === 'active' ? match.score2 : '-'}</span>
                        </div>
                    </div>
                `;

                // Add interactive action button
                if (canUserPlay) {
                    const actionBtn = document.createElement('button');
                    actionBtn.className = 'play-match-btn btn btn-accent pulsing';
                    actionBtn.innerText = 'Зіграти матч';
                    actionBtn.addEventListener('click', () => {
                        if (onPlayMatchClick) onPlayMatchClick(tournament.id, rIndex, mIndex);
                    });
                    matchEl.appendChild(actionBtn);
                } else if (match.status === 'pending' && p1 && p2 && !isUserInMatch) {
                    const actionBtn = document.createElement('button');
                    actionBtn.className = 'simulate-match-btn btn btn-secondary';
                    actionBtn.innerText = 'Симулювати';
                    actionBtn.addEventListener('click', () => {
                        BRACKET.executeSimulation(match, tournament, rIndex, mIndex);
                        // Save and re-render
                        if (window.APP) {
                            window.APP.saveTournaments();
                            window.APP.renderActiveTournament();
                            window.APP.renderLeaderboard();
                        }
                    });
                    matchEl.appendChild(actionBtn);
                } else if (match.status === 'completed' && match.winnerId) {
                    const winnerName = match.winnerId === p1?.id ? p1.name : p2.name;
                    const badge = document.createElement('div');
                    badge.className = 'match-status-badge';
                    badge.innerText = `Переміг ${winnerName}`;
                    matchEl.appendChild(badge);
                }

                matchesList.appendChild(matchEl);
            });

            roundCol.appendChild(matchesList);
            bracketEl.appendChild(roundCol);
        });

        container.appendChild(bracketEl);
    }
};

if (typeof window !== 'undefined') {
    window.BRACKET = BRACKET;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BRACKET };
}
