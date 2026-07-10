<?php
// =====================================================================
// register.php — приймає POST-запит з форми реєстрації і зберігає
// нового користувача (id + нік + email + пароль) у базу даних.
// Виклич цей файл замість firebase.auth().createUserWithEmailAndPassword()
// =====================================================================

require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не дозволений']);
    exit;
}

$username = trim($_POST['username'] ?? '');
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$faction  = $_POST['faction'] ?? 'realms';

if ($username === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Заповніть усі поля']);
    exit;
}

$pdo = getPDO();

// Перевірка, чи email вже зайнятий
$check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$check->execute([$email]);
if ($check->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Цей email вже зареєстрований']);
    exit;
}

// Генеруємо унікальний id гравця
$id = 'u_' . bin2hex(random_bytes(8));
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare('
    INSERT INTO users (id, username, email, password_hash, faction_id, mmr, wins, losses, is_bot)
    VALUES (?, ?, ?, ?, ?, 1000, 0, 0, 0)
');
$stmt->execute([$id, $username, $email, $passwordHash, $faction]);

echo json_encode([
    'success'  => true,
    'id'       => $id,
    'username' => $username
]);
