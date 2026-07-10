<?php
declare(strict_types=1);

// Налаштування заголовків: повертаємо суворий JSON, дозволяємо CORS для локальних тестів
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Ініціалізація сесії для авторизації користувачів
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- КЛАС БАЗИ ДАНИХ ---
class DatabaseHandler {
    private ?PDO $pdo = null;

    public function __construct(
        private string $host = '127.0.0.1',
        private string $dbName = 'gwent_tournament',
        private string $username = 'root',
        private string $password = 'root'
    ) {}

    public function connect(): PDO {
        if ($this->pdo === null) {
            try {
                $dsn = "mysql:host={$this->host};dbname={$this->dbName};charset=utf8mb4";
                $this->pdo = new PDO($dsn, $this->username, $this->password, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            } catch (PDOException $e) {
                echo json_encode(['success' => false, 'message' => "Помилка БД: " . $e->getMessage()]);
                exit;
            }
        }
        return $this->pdo;
    }
}

// Ініціалізуємо підключення
$dbHandler = new DatabaseHandler();
$db = $dbHandler->connect();

// Створюємо таблицю гравців, якщо її ще немає в базі gwent_tournament
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    faction VARCHAR(30) NOT NULL,
    mmr INT DEFAULT 1000,
    wins INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

// Отримуємо вхідні дані (POST запити надходять у форматі JSON)
$inputRaw = file_get_contents('php://input');
$input = json_decode($inputRaw, true) ?? [];
$action = $_GET['action'] ?? $input['action'] ?? 'get_users';

// --- РОУТИНГ ДЛЯ JAVASCRIPT ---
switch ($action) {
    case 'register':
        $user = trim($input['username'] ?? '');
        $pass = trim($input['password'] ?? '');
        $faction = trim($input['faction'] ?? 'realms');
        $id = bin2hex(random_bytes(16));

        if (strlen($user) < 3 || strlen($pass) < 6) {
            echo json_encode(['success' => false, 'message' => 'Нікнейм мін. 3 симв., пароль мін. 6 симв.']);
            break;
        }

        // Перевірка чи існує користувач
        $stmt = $db->prepare("SELECT id FROM users WHERE username = :u");
        $stmt->execute(['u' => $user]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Цей нікнейм уже зайнятий відьмаком.']);
            break;
        }

        // Хешуємо пароль для безпеки

        $hashedPassword = password_hash($pass, PASSWORD_BCRYPT);
        $stmt = $db->prepare("INSERT INTO users (id, username, password_hash, faction_id) VALUES (:id,:u, :p, :f)");
        $success = $stmt->execute(['u' => $user, 'p' => $hashedPassword, 'f' => $faction, 'id' => $id]);

        if ($success) {
            $userId = (int)$db->lastInsertId();
            $_SESSION['user_id'] = $userId;
            echo json_encode([
                'success' => true,
                'message' => 'Реєстрація успішна!',
                'user' => ['id' => $userId, 'username' => $user, 'faction' => $faction, 'mmr' => 1000, 'wins' => 0]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Помилка запису в БД.']);
        }
        break;

    case 'login':
        $user = trim($input['username'] ?? '');
        $pass = trim($input['password'] ?? '');

        $stmt = $db->prepare("SELECT * FROM users WHERE username = :u");
        $stmt->execute(['u' => $user]);
        $userData = $stmt->fetch();

        if ($userData && password_verify($pass, $userData['password'])) {
            $_SESSION['user_id'] = (int)$userData['id'];
            echo json_encode([
                'success' => true,
                'message' => 'Вхід успішний!',
                'user' => [
                    'id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'faction' => $userData['faction'],
                    'mmr' => (int)$userData['mmr'],
                    'wins' => (int)$userData['wins']
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Невірний нікнейм або таємний пароль.']);
        }
        break;

    case 'logout':
        unset($_SESSION['user_id']);
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Сесію закрито.']);
        break;

    case 'get_users':
        // Повертаємо список лідерів за MMR
        $stmt = $db->query("SELECT id, username, faction, mmr, wins FROM users ORDER BY mmr DESC");
        $users = $stmt->fetchAll();
        echo json_encode(['success' => true, 'users' => $users]);
        break;

    case 'update_mmr':
        $userId = (int)($input['id'] ?? 0);
        $points = (int)($input['points'] ?? 0);
        $isWin = (bool)($input['win'] ?? false);

        if ($userId <= 0) {
            echo json_encode(['success' => false, 'message' => 'Невірний ID користувача']);
            break;
        }

        $winIncrement = $isWin ? 1 : 0;
        $stmt = $db->prepare("UPDATE users SET mmr = GREATEST(0, mmr + :p), wins = wins + :w WHERE id = :id");
        $stmt->execute(['p' => $points, 'w' => $winIncrement, 'id' => $userId]);

        echo json_encode(['success' => true, 'message' => 'Рейтинг оновлено в MySQL!']);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Невідома дія бекенду.']);
        break;
}