<?php

declare(strict_types=1);

/**
 * Copies the application's persistent business records from PostgreSQL to a
 * freshly migrated MySQL database. Framework cache, queue and session data is
 * intentionally excluded because it is temporary and environment-specific.
 */

function setting(string $name, string $default = ''): string
{
    $value = getenv($name);

    return $value === false ? $default : $value;
}

function connection(string $dsn, string $username, string $password): PDO
{
    return new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

$source = connection(
    sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        setting('SOURCE_DB_HOST', '127.0.0.1'),
        setting('SOURCE_DB_PORT', '5432'),
        setting('SOURCE_DB_DATABASE', 'youglow'),
    ),
    setting('SOURCE_DB_USERNAME', 'jasfer'),
    setting('SOURCE_DB_PASSWORD'),
);

$target = connection(
    sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        setting('TARGET_DB_HOST', '127.0.0.1'),
        setting('TARGET_DB_PORT', '3306'),
        setting('TARGET_DB_DATABASE', 'youglow'),
    ),
    setting('TARGET_DB_USERNAME', 'root'),
    setting('TARGET_DB_PASSWORD'),
);

$tables = [
    'users',
    'categories',
    'products',
    'product_stocks',
    'orders',
    'order_items',
    'discounts',
    'discount_user',
    'notifications',
    'conversations',
    'messages',
];

$booleanColumns = [
    'users' => ['marketing_consent'],
    'products' => ['is_active'],
    'discounts' => ['is_active'],
];

foreach ($tables as $table) {
    $count = (int) $target->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    if ($count > 0) {
        fwrite(STDERR, "Transfer stopped: MySQL table {$table} already contains data.\n");
        exit(1);
    }
}

$target->beginTransaction();

try {
    foreach ($tables as $table) {
        $rows = $source->query("SELECT * FROM \"{$table}\"")->fetchAll();

        if ($rows === []) {
            echo "{$table}: 0 rows\n";
            continue;
        }

        $columns = array_keys($rows[0]);
        $quotedColumns = implode(', ', array_map(
            static fn (string $column): string => "`{$column}`",
            $columns,
        ));
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $insert = $target->prepare("INSERT INTO `{$table}` ({$quotedColumns}) VALUES ({$placeholders})");

        foreach ($rows as $row) {
            foreach ($booleanColumns[$table] ?? [] as $column) {
                $row[$column] = filter_var($row[$column], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            }

            foreach ($row as $column => $value) {
                if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}(?::?\d{2})?$/', $value)) {
                    $row[$column] = (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
                }
            }

            $insert->execute(array_values($row));
        }

        echo "{$table}: ".count($rows)." rows\n";
    }

    $target->commit();
    echo "PostgreSQL data transfer completed successfully.\n";
} catch (Throwable $exception) {
    if ($target->inTransaction()) {
        $target->rollBack();
    }

    fwrite(STDERR, "Transfer failed: {$exception->getMessage()}\n");
    exit(1);
}
