<?php
// =====================================================================
// config.php — підключення до бази даних + налаштування адмінки
// =====================================================================

// --- Дані підключення до MySQL (заміни на свої, якщо відрізняються) ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'gwent_tournament');
define('DB_USER', 'root');
define('DB_PASS', 'root');          // у XAMPP за замовчуванням пароль порожній
define('DB_CHARSET', 'utf8mb4');

// --- Пароль для входу в адмінку ---
// Це НЕ сам пароль, а його хеш. Щоб згенерувати свій хеш, виконай у консолі:
//   php -r "echo password_hash('твій_пароль', PASSWORD_DEFAULT);"
// і встав результат сюди замість значення нижче.
// Значення нижче відповідає паролю: admin123  (ОБОВ'ЯЗКОВО зміни перед деплоєм!)
define('ADMIN_PASSWORD_HASH', '$2y$10$.QS7LNsH0o7FKBB.mAqBU.SkIEk9DoZYcPJ2PyyH/2.8yB.HOYiry');

// --- З'єднання PDO ---
function getPDO(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            die('Помилка підключення до бази даних: ' . $e->getMessage());
        }
    }
    return $pdo;
}

// --- Запуск сесії (потрібно для авторизації адміна) ---
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- Хелпер: перевірити, чи адмін залогінений ---
function isAdminLoggedIn(): bool {
    return isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;
}

// --- Хелпер: вимагати авторизацію (редіректить на логін, якщо не залогінений) ---
function requireAdmin(): void {
    if (!isAdminLoggedIn()) {
        header('Location: admin_login.php');
        exit;
    }
}
