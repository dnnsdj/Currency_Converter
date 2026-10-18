<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/rates.php';
require_once __DIR__ . '/../api/alert-store.php';

function alertHasBeenReached($alert, $currentRate)
{
    $previousRate = (float) $alert['last_rate'];
    $threshold = (float) $alert['threshold'];

    if ($alert['alert_type'] === 'target') {
        return $alert['direction'] === 'above'
            ? $previousRate < $threshold && $currentRate >= $threshold
            : $previousRate > $threshold && $currentRate <= $threshold;
    }

    $baselineRate = (float) $alert['baseline_rate'];
    $percentChange = (($currentRate / $baselineRate) - 1) * 100;
    if ($alert['direction'] === 'up') {
        return $percentChange >= $threshold;
    }
    if ($alert['direction'] === 'down') {
        return $percentChange <= -$threshold;
    }
    return abs($percentChange) >= $threshold;
}

function formatAlertRate($rate)
{
    return rtrim(rtrim(sprintf('%.12F', $rate), '0'), '.');
}

try {
    $database = getAlertDatabase();
    $currencyConfig = getCurrencyConfig();
    $database->exec(
        'DELETE FROM alerts WHERE confirmed_at IS NULL AND expires_at < ' . time()
    );

    $pairs = $database->query(
        'SELECT DISTINCT from_currency, to_currency
        FROM alerts WHERE active = 1 AND confirmed_at IS NOT NULL'
    )->fetchAll();
    $hadFailures = false;

    foreach ($pairs as $pair) {
        try {
            $rateData = getExchangeRate(
                $pair['from_currency'],
                $pair['to_currency'],
                $currencyConfig
            );
        } catch (RuntimeException $error) {
            error_log(
                'Could not check rate alerts for ' . $pair['from_currency'] . '/' .
                $pair['to_currency'] . ': ' . $error->getMessage()
            );
            $hadFailures = true;
            continue;
        }

        $currentRate = $rateData['rate'];
        $database->beginTransaction();
        try {
            $lock = $database->prepare(
                'UPDATE alerts SET last_rate = last_rate
                WHERE from_currency = :from_currency
                    AND to_currency = :to_currency
                    AND active = 1
                    AND confirmed_at IS NOT NULL'
            );
            $lock->execute([
                'from_currency' => $pair['from_currency'],
                'to_currency' => $pair['to_currency'],
            ]);

            $statement = $database->prepare(
                'SELECT * FROM alerts
                WHERE from_currency = :from_currency
                    AND to_currency = :to_currency
                    AND active = 1
                    AND confirmed_at IS NOT NULL'
            );
            $statement->execute([
                'from_currency' => $pair['from_currency'],
                'to_currency' => $pair['to_currency'],
            ]);
            $alerts = $statement->fetchAll();

            foreach ($alerts as $alert) {
                if (!alertHasBeenReached($alert, $currentRate)) {
                    $updateRate = $database->prepare(
                        'UPDATE alerts SET last_rate = :last_rate WHERE id = :id'
                    );
                    $updateRate->execute(['last_rate' => $currentRate, 'id' => $alert['id']]);
                    continue;
                }

                $from = $alert['from_currency'];
                $to = $alert['to_currency'];
                if ($alert['alert_type'] === 'target') {
                    $condition = $alert['direction'] === 'above' ? 'at or above' : 'at or below';
                    $details = 'Your target condition was ' . $condition . ' ' .
                        formatAlertRate((float) $alert['threshold']) . ' ' . $to . '.';
                } else {
                    $percentChange =
                        (($currentRate / (float) $alert['baseline_rate']) - 1) * 100;
                    $details = 'The rate changed ' . sprintf('%+.4f', $percentChange) .
                        '% from its starting rate of ' .
                        formatAlertRate((float) $alert['baseline_rate']) . ' ' . $to . '.';
                }

                $message = 'The rate for 1 ' . $from . ' is now ' .
                    formatAlertRate($currentRate) . ' ' . $to . ".\n\n" .
                    $details . "\n\nRate date: " . $rateData['date'] .
                    "\n\nThis one-time alert has been deactivated.";

                if (!sendAlertEmail($alert['email'], 'Your currency rate alert', $message)) {
                    error_log('Could not send rate alert email for alert ID ' . $alert['id'] . '.');
                    $hadFailures = true;
                    continue;
                }

                $deleteAlert = $database->prepare('DELETE FROM alerts WHERE id = :id');
                $deleteAlert->execute(['id' => $alert['id']]);
                echo 'Sent rate alert for ' . $from . '/' . $to . " to " . $alert['email'] . ".\n";
            }

            $database->commit();
        } catch (Throwable $error) {
            if ($database->inTransaction()) {
                $database->rollBack();
            }
            throw $error;
        }
    }

    exit($hadFailures ? 1 : 0);
} catch (Throwable $error) {
    error_log('Rate alert monitor failed: ' . $error->getMessage());
    exit(1);
}
