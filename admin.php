<?php
require_once __DIR__ . '/config.php';
requireAdmin(); // редіректить на admin_login.php, якщо не залогінений

$pdo = getPDO();

// Тягнемо тільки реальних користувачів (без ботів), найновіші — зверху
$stmt = $pdo->query("
    SELECT id, username, email, mmr, wins, losses, created_at
    FROM users
    WHERE is_bot = 0
    ORDER BY created_at DESC
");
$users = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>Адмінка — Користувачі</title>
<style>
    body {
        background: #14141c;
        color: #e8e0cf;
        font-family: 'Segoe UI', sans-serif;
        margin: 0;
        padding: 30px;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    h1 { color: #d4af37; font-size: 1.4rem; margin: 0; }
    a.logout {
        color: #e05c5c;
        text-decoration: none;
        font-size: 0.85rem;
        border: 1px solid #e05c5c;
        padding: 6px 12px;
        border-radius: 4px;
    }
    a.logout:hover { background: #e05c5c; color: #14141c; }
    table {
        width: 100%;
        border-collapse: collapse;
        background: #1e1e2a;
        border-radius: 8px;
        overflow: hidden;
    }
    th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #2a2a3a;
        font-size: 0.9rem;
    }
    th {
        background: #26263a;
        color: #d4af37;
        font-weight: 600;
    }
    tr:hover td { background: #26263a; }
    .empty { padding: 30px; text-align: center; color: #888; font-style: italic; }
    .count { color: #888; font-size: 0.85rem; margin-bottom: 14px; }
</style>
</head>
<body>
    <div class="header">
        <h1>👥 Зареєстровані користувачі</h1>
        <a class="logout" href="admin_logout.php">Вийти</a>
    </div>

    <div class="count">Всього: <?= count($users) ?></div>

    <?php if (empty($users)): ?>
        <div class="empty">Поки що немає зареєстрованих користувачів.</div>
    <?php else: ?>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Нік</th>
                    <th>Email</th>
                    <th>MMR</th>
                    <th>W / L</th>
                    <th>Дата реєстрації</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $u): ?>
                    <tr>
                        <td><code><?= htmlspecialchars($u['id']) ?></code></td>
                        <td><?= htmlspecialchars($u['username']) ?></td>
                        <td><?= htmlspecialchars($u['email'] ?? '—') ?></td>
                        <td><?= (int)$u['mmr'] ?></td>
                        <td><?= (int)$u['wins'] ?> / <?= (int)$u['losses'] ?></td>
                        <td><?= htmlspecialchars($u['created_at']) ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</body>
</html>
