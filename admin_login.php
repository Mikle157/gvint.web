<?php
require_once __DIR__ . '/config.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';

    if (password_verify($password, ADMIN_PASSWORD_HASH)) {
        // Захист від session fixation
        session_regenerate_id(true);
        $_SESSION['is_admin'] = true;
        header('Location: admin.php');
        exit;
    } else {
        $error = 'Невірний пароль.';
    }
}

// Якщо вже залогінений — одразу в адмінку
if (isAdminLoggedIn()) {
    header('Location: admin.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>Вхід в адмінку — Gwent Tournament</title>
<style>
    body {
        background: #14141c;
        color: #e8e0cf;
        font-family: 'Segoe UI', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
    }
    .login-box {
        background: #1e1e2a;
        border: 1px solid #3a3a4a;
        border-radius: 8px;
        padding: 32px;
        width: 300px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    h1 { font-size: 1.2rem; margin: 0 0 20px; text-align: center; color: #d4af37; }
    input[type="password"] {
        width: 100%;
        padding: 10px;
        margin-bottom: 14px;
        border-radius: 4px;
        border: 1px solid #3a3a4a;
        background: #14141c;
        color: #e8e0cf;
        box-sizing: border-box;
    }
    button {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: 4px;
        background: #d4af37;
        color: #14141c;
        font-weight: bold;
        cursor: pointer;
    }
    button:hover { background: #e8c65a; }
    .error { color: #e05c5c; font-size: 0.85rem; margin-bottom: 12px; text-align: center; }
</style>
</head>
<body>
    <div class="login-box">
        <h1>🔒 Вхід в адмінку</h1>
        <?php if ($error): ?>
            <div class="error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <form method="POST">
            <input type="password" name="password" placeholder="Пароль адміна" autofocus required>
            <button type="submit">Увійти</button>
        </form>
    </div>
</body>
</html>
