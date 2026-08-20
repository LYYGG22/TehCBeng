<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$users = [
	'admin@intellihub.com' => [
		'password' => 'admin123',
		'name' => 'System Admin',
		'role' => 'Admin',
	],
    'manager@intellihub.com' => [
        'password' => 'manager123',
        'name' => 'Case Manager',
        'role' => 'Manager',
    ],
    'staff@intellihub.com' => [
        'password' => 'staff123',
        'name' => 'Fraud Staff',
        'role' => 'Staff',
    ],
];

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($users);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
        handleCheck();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

function handleLogin(array $users): void
{
    $data = json_decode(file_get_contents('php://input'), true);
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required.']);
        return;
    }

    if (!isset($users[$email]) || $users[$email]['password'] !== $password) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password.']);
        return;
    }

    $_SESSION['user'] = [
        'email' => $email,
        'name' => $users[$email]['name'],
        'role' => $users[$email]['role'],
    ];

    echo json_encode([
        'success' => true,
        'user' => $_SESSION['user'],
    ]);
}

function handleLogout(): void
{
    session_destroy();
    echo json_encode(['success' => true]);
}

function handleCheck(): void
{
    if (isset($_SESSION['user'])) {
        echo json_encode([
            'authenticated' => true,
            'user' => $_SESSION['user'],
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
}

function requireAuth(): void
{
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required.']);
        exit;
    }
}
