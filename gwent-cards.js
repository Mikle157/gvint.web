const GWENT_CARDS = {
    neutral: [
        { id: 'geralt', name: 'Геральт з Рівії', power: 15, type: 'close', ability: 'hero', desc: 'Імунітет до погодних ефектів та спеціальних карт.', image: '🐺' },
        { id: 'ciri', name: 'Цірілла', power: 15, type: 'close', ability: 'hero', desc: 'Імунітет до погодних ефектів та спеціальних карт.', image: '⚔️' },
        { id: 'yennefer', name: 'Йеннефер з Венґерберґа', power: 7, type: 'ranged', ability: 'medic', desc: 'Герой. Лікар: повертає одну випадкову карту з відбою на поле бою.', image: '🔮' },
        { id: 'triss', name: 'Трісс Мерігольд', power: 7, type: 'close', ability: 'hero', desc: 'Імунітет до погодних ефектів та спеціальних карт.', image: '🔥' },
        { id: 'dandelion', name: 'Любисток', power: 2, type: 'close', ability: 'horn', desc: 'Сурма командира: подвоює силу всіх загонів у цьому ряду.', image: '🪕' },
        { id: 'mysterious_elf', name: 'Таємничий ельф (Аваллак\'х)', power: 0, type: 'close', ability: 'spy', desc: 'Шпигун: викладається на полі суперника (додає 0 сили), але ви берете 2 карти з колоди.', image: '🧝' },
        { id: 'horn', name: 'Сурма командира', power: 0, type: 'special', ability: 'horn_special', desc: 'Подвоює силу всіх юнітів у вибраному ряду.', image: '📯' },
        { id: 'scorch', name: 'Казнь', power: 0, type: 'special', ability: 'scorch', desc: 'Знищує найсильнішу карту (або карти) на всьому полі бою.', image: '💀' },
        { id: 'decoy', name: 'Опудало', power: 0, type: 'special', ability: 'decoy', desc: 'Замінює вашу карту на полі бою назад у руку.', image: '🌾' }
    ],
    monsters: [
        { id: 'eredin_leader', name: 'Ередін Бреакк Глас', power: 0, type: 'leader', ability: 'leader_monsters', desc: 'Лідер: Збільшує силу рукопашних загонів у 2 рази один раз за гру.', image: '👑' },
        { id: 'leshen', name: 'Лісовик', power: 10, type: 'ranged', ability: 'weather_fog', desc: 'Прикликає Імлу на стіл.', image: '🌲' },
        { id: 'imlerith', name: 'Імлеріх', power: 10, type: 'close', ability: 'hero', desc: 'Герой.', image: '🔨' },
        { id: 'fiend', name: 'Біс', power: 6, type: 'close', ability: 'none', desc: 'Звичайний загін.', image: '🐂' },
        { id: 'arachas', name: 'Арахас', power: 4, type: 'close', ability: 'muster', desc: 'Збір: автоматично закликає інших Арахасів з вашої колоди.', image: '🕷️' },
        { id: 'ghoul', name: 'Гуль', power: 1, type: 'close', ability: 'muster', desc: 'Збір: закликає інших Гулів.', image: '🧟' }
    ],
    nilfgaard: [
        { id: 'emhyr_leader', name: 'Емгир вар Емрейс', power: 0, type: 'leader', ability: 'leader_nilfgaard', desc: 'Лідер: Дозволяє подивитися 3 випадкові карти з руки суперника.', image: '👑' },
        { id: 'letho', name: 'Лето з Ґулети', power: 10, type: 'close', ability: 'hero', desc: 'Герой.', image: '🐍' },
        { id: 'tibor', name: 'Тібор Еггебрахт', power: 10, type: 'ranged', ability: 'hero', desc: 'Герой.', image: '🛡️' },
        { id: 'stefan_skellen', name: 'Стефан Скеллен', power: 9, type: 'close', ability: 'spy', desc: 'Шпигун: дає супернику 9 сили, але ви берете 2 карти.', image: '👁️' },
        { id: 'black_infantry', name: 'Чорна піхота', power: 6, type: 'close', ability: 'none', desc: 'Звичайний загін.', image: '⚔️' },
        { id: 'albrich', name: 'Альбріх', power: 2, type: 'ranged', ability: 'none', desc: 'Маг-астролог.', image: '🌙' }
    ],
    realms: [
        { id: 'foltest_leader', name: 'Фольтест, Завойовник', power: 0, type: 'leader', ability: 'leader_realms', desc: 'Лідер: Очищує погодні ефекти на столі.', image: '👑' },
        { id: 'philippa', name: 'Філіппа Ейльхарт', power: 10, type: 'ranged', ability: 'hero', desc: 'Герой.', image: '🦉' },
        { id: 'vernon_roche', name: 'Вернон Роше', power: 10, type: 'close', ability: 'hero', desc: 'Герой.', image: '🧢' },
        { id: 'catapult', name: 'Катапульта', power: 8, type: 'siege', ability: 'bond', desc: 'Зв\'язок: сила подвоюється, якщо поруч стоїть ще одна катапульта.', image: '☄️' },
        { id: 'trebuchet', name: 'Требушет', power: 6, type: 'siege', ability: 'none', desc: 'Облоговий загін.', image: '🏹' },
        { id: 'blue_stripes', name: 'Бійці Синіх Смуг', power: 4, type: 'close', ability: 'bond', desc: 'Зв\'язок: подвоює силу за кожного бійця Синіх Смуг на полі.', image: '👕' }
    ],
    scoiatael: [
        { id: 'francesca_leader', name: 'Францеска Фіндабаїр', power: 0, type: 'leader', ability: 'leader_scoiatael', desc: 'Лідер: Дозволяє взяти додаткову карту на початку 2-го раунду.', image: '👑' },
        { id: 'saskia', name: 'Саскія / Саесентнессіс', power: 10, type: 'close', ability: 'hero', desc: 'Герой.', image: '🐉' },
        { id: 'iorveth', name: 'Йорвет', power: 10, type: 'ranged', ability: 'hero', desc: 'Герой.', image: '🏹' },
        { id: 'isengrim', name: 'Ізенгрім Фаоіiltіарна', power: 10, type: 'close', ability: 'hero_morale', desc: 'Герой. Мораль: додає +1 силу всім загонам у ряду.', image: '🪵' },
        { id: 'elven_skirmisher', name: 'Ельфійський застрільник', power: 2, type: 'ranged', ability: 'muster', desc: 'Збір: закликає інших застрільників.', image: '🍃' },
        { id: 'barclay', name: 'Барклай Елс', power: 6, type: 'close', ability: 'morale', desc: 'Додає +1 силу всім піхотинцям.', image: '🍻' }
    ],
    skellige: [
        { id: 'bran_leader', name: 'Король Бран', power: 0, type: 'leader', ability: 'leader_skellige', desc: 'Лідер: Загони втрачають лише половину сили під дією негоди.', image: '👑' },
        { id: 'cerys', name: 'Керіс ан Крайт', power: 10, type: 'close', ability: 'hero_muster', desc: 'Герой. Закликає войовниць Керіс.', image: '👩‍🦰' },
        { id: 'hjalmar', name: 'Хьялмар ан Крайт', power: 10, type: 'ranged', ability: 'hero', desc: 'Герой.', image: '⛵' },
        { id: 'olaf', name: 'Ведмідь Олаф', power: 12, type: 'close', ability: 'morale', desc: 'Мораль: +1 сила всім юнітам у ряду.', image: '🐻' },
        { id: 'clan_an_craite', name: 'Воїн клану Ан Крайт', power: 6, type: 'close', ability: 'tight_bond', desc: 'Зв\'язок.', image: '🪓' },
        { id: 'kambi', name: 'Камбі', power: 0, type: 'close', ability: 'kambi', desc: 'Коли карту знищено, прикликає Хеймдалля (11 сили).', image: '🐓' }
    ]
};

const GWENT_FACTIONS = {
    monsters: {
        id: 'monsters',
        name: 'Монстри',
        ability: 'Лишає одну випадкову карту на полі бою після завершення кожного раунду.',
        themeColor: '#7e1e1e',
        leader: 'eredin_leader',
        emblem: '🐉'
    },
    nilfgaard: {
        id: 'nilfgaard',
        name: 'Нільфгаард',
        ability: 'Перемагає при будь-якій нічиїй в раунді.',
        themeColor: '#d4af37',
        leader: 'emhyr_leader',
        emblem: '☀️'
    },
    realms: {
        id: 'realms',
        name: 'Королівства Півночі',
        ability: 'Бере додаткову карту з колоди щоразу, коли виграє раунд.',
        themeColor: '#1e3d7e',
        leader: 'foltest_leader',
        emblem: '🦅'
    },
    scoiatael: {
        id: 'scoiatael',
        name: 'Скоя\'таелі',
        ability: 'Вирішує, хто ходить першим на початку гри.',
        themeColor: '#1e7e3d',
        leader: 'francesca_leader',
        emblem: '🏹'
    },
    skellige: {
        id: 'skellige',
        name: 'Скелліге',
        ability: 'У третьому раунді повертає 2 випадкові карти з відбою на поле.',
        themeColor: '#5c2d91',
        leader: 'bran_leader',
        emblem: '⛵'
    }
};

// Export to window object for web access, and module.exports for node testing
if (typeof window !== 'undefined') {
    window.GWENT_CARDS = GWENT_CARDS;
    window.GWENT_FACTIONS = GWENT_FACTIONS;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GWENT_CARDS, GWENT_FACTIONS };
}
