<?php
require_once __DIR__ . '/rates.php';
require_once __DIR__ . '/alert-store.php';

function sendAlertJson($statusCode, $response)
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response);
    exit;
}

function findAlertByToken($database, $token)
{
    $statement = $database->prepare('SELECT * FROM alerts WHERE token_hash = :token_hash');
    $statement->execute(['token_hash' => hash('sha256', $token)]);
    return $statement->fetch();
}

function processAlertAction($database, $action, $token)
{
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        throw new InvalidArgumentException('The alert link is invalid.');
    }

    $alert = findAlertByToken($database, $token);
    if (!$alert) {
        throw new InvalidArgumentException('This alert link is invalid or has expired.');
    }

    if ($action === 'confirm') {
        if ($alert['confirmed_at'] === null && (int) $alert['expires_at'] < time()) {
            $statement = $database->prepare('DELETE FROM alerts WHERE id = :id AND confirmed_at IS NULL');
            $statement->execute(['id' => $alert['id']]);
            throw new InvalidArgumentException('This confirmation link has expired. Please create the alert again.');
        }
        if ($alert['confirmed_at'] === null) {
            $statement = $database->prepare(
                'UPDATE alerts SET confirmed_at = :confirmed_at WHERE id = :id AND confirmed_at IS NULL'
            );
            $statement->execute(['confirmed_at' => time(), 'id' => $alert['id']]);
        }
        return 'Your email is confirmed. We will send one alert when the rate condition is met.';
    }

    if ($action === 'unsubscribe') {
        $statement = $database->prepare('DELETE FROM alerts WHERE id = :id');
        $statement->execute(['id' => $alert['id']]);
        return 'This rate alert has been cancelled.';
    }

    throw new InvalidArgumentException('Unsupported alert action.');
}

$httpMethod = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $httpMethod === 'GET'
    ? ($_GET['action'] ?? '')
    : ($_POST['action'] ?? '');

if ($httpMethod === 'GET' && in_array($action, ['confirm', 'unsubscribe'], true)) {
    $token = $_GET['token'] ?? '';
    $title = $action === 'confirm' ? 'Confirm rate alert' : 'Cancel rate alert';
    $message = $action === 'confirm'
        ? 'Confirm your email address to activate this one-time rate alert.'
        : 'Cancel this rate alert?';
    renderAlertActionPage($title, $message, $action, is_string($token) ? $token : '');
    exit;
}

if ($httpMethod !== 'POST') {
    header('Allow: GET, POST');
    sendAlertJson(405, ['error' => 'Only POST requests are supported.']);
}

try {
    $database = getAlertDatabase();

    if ($action === 'confirm' || $action === 'unsubscribe') {
        try {
            $message = processAlertAction($database, $action, $_POST['token'] ?? null);
        } catch (InvalidArgumentException $error) {
            http_response_code(400);
            header('Content-Type: text/html; charset=utf-8');
            header('Cache-Control: no-store');
            echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Rate alert</title>' .
                '<body><main><h1>Rate alert</h1><p>' .
                htmlspecialchars($error->getMessage(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') .
                '</p></main></body></html>';
            exit;
        }
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Rate alert</title>' .
            '<body><main><h1>Rate alert</h1><p>' .
            htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') .
            '</p></main></body></html>';
        exit;
    }

    $request = json_decode(file_get_contents('php://input'), true);
    if (!is_array($request) || ($request['action'] ?? null) !== 'subscribe') {
        sendAlertJson(400, ['error' => 'A valid subscribe request is required.']);
    }

    $email = $request['email'] ?? null;
    $fromCurrency = $request['from'] ?? null;
    $toCurrency = $request['to'] ?? null;
    $alertType = $request['alertType'] ?? null;
    $direction = $request['direction'] ?? null;
    $threshold = $request['threshold'] ?? null;

    if (!is_string($email) || strlen($email) > 254 ||
        filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        sendAlertJson(400, ['error' => 'Enter a valid email address.']);
    }
    if (!is_string($fromCurrency) || !is_string($toCurrency) ||
        $fromCurrency === $toCurrency ||
        !in_array($alertType, ['target', 'percent'], true)) {
        sendAlertJson(400, ['error' => 'Choose two different supported currencies and an alert type.']);
    }
    if (!is_numeric($threshold) || !is_finite((float) $threshold) || (float) $threshold <= 0) {
        sendAlertJson(400, ['error' => 'Enter a threshold greater than zero.']);
    }

    $threshold = (float) $threshold;
    if (($alertType === 'target' && !in_array($direction, ['above', 'below'], true)) ||
        ($alertType === 'percent' && !in_array($direction, ['up', 'down', 'either'], true)) ||
        ($alertType === 'percent' && $threshold > 10000)) {
        sendAlertJson(400, ['error' => 'Choose a valid alert direction and threshold.']);
    }

    $currencyConfig = getCurrencyConfig();
    $supportedCurrencies = array_column($currencyConfig, 'code');
    if (!in_array($fromCurrency, $supportedCurrencies, true) ||
        !in_array($toCurrency, $supportedCurrencies, true)) {
        sendAlertJson(400, ['error' => 'Choose supported currencies.']);
    }

    $baseUrl = getAlertBaseUrl();
    getAlertMailFrom();
    try {
        $baseline = getExchangeRate($fromCurrency, $toCurrency, $currencyConfig);
    } catch (RuntimeException $error) {
        error_log('Could not create rate alert baseline: ' . $error->getMessage());
        sendAlertJson(502, ['error' => 'The current rate is unavailable. Please try again.']);
    }

    $now = time();
    $token = bin2hex(random_bytes(32));
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ipHash = hash('sha256', $ipAddress);
    $database->beginTransaction();
    $database->exec('DELETE FROM alert_attempts WHERE attempted_at < ' . ($now - 86400));

    $attemptStatement = $database->prepare(
        'SELECT COUNT(*) FROM alert_attempts WHERE ip_hash = :ip_hash AND attempted_at >= :since'
    );
    $attemptStatement->execute(['ip_hash' => $ipHash, 'since' => $now - 3600]);
    if ((int) $attemptStatement->fetchColumn() >= 5) {
        $database->rollBack();
        sendAlertJson(429, ['error' => 'Too many alert requests. Please try again in an hour.']);
    }

    $emailStatement = $database->prepare(
        'SELECT COUNT(*) FROM alerts WHERE lower(email) = lower(:email) AND created_at >= :since'
    );
    $emailStatement->execute(['email' => $email, 'since' => $now - 86400]);
    if ((int) $emailStatement->fetchColumn() >= 10) {
        $database->rollBack();
        sendAlertJson(429, ['error' => 'Too many alerts have been requested for this email address today.']);
    }

    $attemptInsert = $database->prepare(
        'INSERT INTO alert_attempts (ip_hash, attempted_at) VALUES (:ip_hash, :attempted_at)'
    );
    $attemptInsert->execute(['ip_hash' => $ipHash, 'attempted_at' => $now]);
    $alertInsert = $database->prepare(
        'INSERT INTO alerts (
            email, from_currency, to_currency, alert_type, direction, threshold,
            baseline_rate, last_rate, token_hash, created_at, expires_at
        ) VALUES (
            :email, :from_currency, :to_currency, :alert_type, :direction, :threshold,
            :baseline_rate, :last_rate, :token_hash, :created_at, :expires_at
        )'
    );
    $alertInsert->execute([
        'email' => $email,
        'from_currency' => $fromCurrency,
        'to_currency' => $toCurrency,
        'alert_type' => $alertType,
        'direction' => $direction,
        'threshold' => $threshold,
        'baseline_rate' => $baseline['rate'],
        'last_rate' => $baseline['rate'],
        'token_hash' => hash('sha256', $token),
        'created_at' => $now,
        'expires_at' => $now + 86400,
    ]);
    $database->commit();

    $confirmationUrl = $baseUrl . '/api/alerts.php?action=confirm&token=' . rawurlencode($token);
    $cancelUrl = $baseUrl . '/api/alerts.php?action=unsubscribe&token=' . rawurlencode($token);
    if ($alertType === 'target') {
        $targetCondition = $direction === 'above' ? 'rises to or above' : 'falls to or below';
        $alertDescription = '1 ' . $fromCurrency . ' ' . $targetCondition . ' ' .
            $threshold . ' ' . $toCurrency . '.';
    } else {
        $movement = $direction === 'either'
            ? 'moves up or down'
            : ($direction === 'up' ? 'moves up' : 'moves down');
        $alertDescription = '1 ' . $fromCurrency . ' ' . $movement . ' by ' .
            $threshold . '% from the current rate of ' . $baseline['rate'] . ' ' .
            $toCurrency . '.';
    }
    $body = "You requested this currency rate alert:\n" . $alertDescription .
        "\n\nConfirm your email address to activate it:\n\n" . $confirmationUrl .
        "\n\nCancel this alert at any time:\n" . $cancelUrl .
        "\n\nThe confirmation link expires in 24 hours. If you did not request this alert, ignore this email.";
    if (!sendAlertEmail($email, 'Confirm your currency rate alert', $body)) {
        $deleteStatement = $database->prepare('DELETE FROM alerts WHERE token_hash = :token_hash');
        $deleteStatement->execute(['token_hash' => hash('sha256', $token)]);
        error_log('Could not send a rate-alert confirmation email.');
        sendAlertJson(502, ['error' => 'Could not send the confirmation email. Check the server mail configuration.']);
    }

    sendAlertJson(202, ['message' => 'Check your email to confirm this rate alert.']);
} catch (InvalidArgumentException $error) {
    if (isset($database) && $database->inTransaction()) {
        $database->rollBack();
    }
    sendAlertJson(400, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log('Rate alert request failed: ' . $error->getMessage());
    sendAlertJson(500, ['error' => 'Could not process this rate alert. Check the server configuration.']);
}
