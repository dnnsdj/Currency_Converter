<?php

function getAlertDatabase()
{
    $databasePath = getenv('CURRENCY_CONVERTER_ALERT_DB');
    if ($databasePath === false || $databasePath === '') {
        $databasePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR .
            'currency-converter-alerts-' . hash('sha256', dirname(__DIR__));
    }

    $databaseDirectory = dirname($databasePath);
    if (!is_dir($databaseDirectory) && !mkdir($databaseDirectory, 0700, true)) {
        throw new RuntimeException('Could not create the rate alert database directory.');
    }

    $database = new PDO('sqlite:' . $databasePath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $database->exec('PRAGMA busy_timeout = 5000');
    $database->exec('PRAGMA journal_mode = WAL');
    $database->exec(
        'CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            from_currency TEXT NOT NULL,
            to_currency TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            direction TEXT NOT NULL,
            threshold REAL NOT NULL,
            baseline_rate REAL NOT NULL,
            last_rate REAL NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            confirmed_at INTEGER,
            active INTEGER NOT NULL DEFAULT 1
        )'
    );
    $database->exec(
        'CREATE TABLE IF NOT EXISTS alert_attempts (
            ip_hash TEXT NOT NULL,
            attempted_at INTEGER NOT NULL
        )'
    );
    $database->exec(
        'CREATE INDEX IF NOT EXISTS alerts_pair_active
        ON alerts(from_currency, to_currency, active, confirmed_at)'
    );
    $database->exec(
        'CREATE INDEX IF NOT EXISTS alert_attempts_ip_time
        ON alert_attempts(ip_hash, attempted_at)'
    );
    chmod($databasePath, 0600);

    return $database;
}

function getAlertBaseUrl()
{
    $baseUrl = getenv('CURRENCY_CONVERTER_BASE_URL');
    if ($baseUrl === false || $baseUrl === '') {
        throw new RuntimeException('Set CURRENCY_CONVERTER_BASE_URL before enabling email alerts.');
    }

    $parts = parse_url($baseUrl);
    $host = is_array($parts) && isset($parts['host'])
        ? trim($parts['host'], '[]')
        : null;
    $isLocalHttp = is_array($parts) &&
        isset($parts['scheme'], $parts['host']) &&
        $parts['scheme'] === 'http' &&
        in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    if (!is_array($parts) ||
        !isset($parts['scheme'], $parts['host']) ||
        ($parts['scheme'] !== 'https' && !$isLocalHttp) ||
        isset($parts['user']) ||
        isset($parts['pass']) ||
        isset($parts['query']) ||
        isset($parts['fragment'])) {
        throw new RuntimeException('CURRENCY_CONVERTER_BASE_URL must be an HTTPS URL (or localhost for development).');
    }

    return rtrim($baseUrl, '/');
}

function getAlertMailFrom()
{
    $sender = getenv('CURRENCY_CONVERTER_MAIL_FROM');
    if ($sender === false || filter_var($sender, FILTER_VALIDATE_EMAIL) === false) {
        throw new RuntimeException('Set CURRENCY_CONVERTER_MAIL_FROM to a valid sender address.');
    }
    return $sender;
}

function sendAlertEmail($recipient, $subject, $message)
{
    $sender = getAlertMailFrom();
    $headers = [
        'From: ' . $sender,
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: PHP/' . phpversion(),
    ];

    return mail($recipient, $subject, $message, implode("\r\n", $headers));
}

function renderAlertActionPage($title, $message, $action, $token)
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeToken = htmlspecialchars($token, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $actionUrl = htmlspecialchars($_SERVER['SCRIPT_NAME'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    header('Cache-Control: no-store');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">' .
        '<title>' . $safeTitle . '</title><body><main><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p>' .
        '<form method="post" action="' . $actionUrl . '">' .
        '<input type="hidden" name="action" value="' . $action . '">' .
        '<input type="hidden" name="token" value="' . $safeToken . '">' .
        '<button type="submit">' . ($action === 'confirm' ? 'Confirm alert' : 'Unsubscribe') . '</button>' .
        '</form></main></body></html>';
}
