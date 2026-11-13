# You Glow Cebu — Laravel + XAMPP MySQL

The application runs locally with Laravel 12, XAMPP PHP 8.2, and XAMPP MariaDB/MySQL. All customer, product, stock, order, discount, and conversation records were transferred from the earlier PostgreSQL database.

## Open the website

1. Open **XAMPP Manager** and start **MySQL**.
2. Double-click `open-local.command`.
3. Keep its Terminal window open and use <http://127.0.0.1:4173/>.
4. Press **Control+C** in that Terminal window when finished.

The launcher checks that XAMPP MySQL is running before starting Laravel.

## System documentation

- [Process flow and separated modules](docs/PROCESS_FLOW.md)

## View the database

Start **Apache** and **MySQL** in XAMPP Manager, then open <http://localhost/phpmyadmin>. The application database is named `youglow`.

Connection settings:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `youglow`
- Username: `root`
- Password: blank (the default local XAMPP setup)

## Developer commands

```bash
cd backend
/Applications/XAMPP/xamppfiles/bin/php artisan serve --host=127.0.0.1 --port=4173
```

Run migrations and tests with:

```bash
/Applications/XAMPP/xamppfiles/bin/php artisan migrate
/Applications/XAMPP/xamppfiles/bin/php artisan test
```

## Current architecture

MySQL-compatible Laravel migrations and Eloquent models cover users and roles, categories, products, expiring stock batches, orders and items, targeted discounts, notifications, customer conversations, and messages.

Working Laravel-backed features include customer registration and sign-in, persistent profiles, catalog filtering and cart, server-calculated checkout totals, private payment-receipt storage, FIFO stock deduction, account order history, customer/admin messaging, admin catalog management, CRM customer segments, and fulfillment status updates.

Demo records are available only in local and test environments. Production
seeding is blocked to prevent test credentials from being deployed. Create the
first live administrator interactively with:

```bash
php artisan app:create-admin admin@your-domain.com --name="Administrator"
```

The command requires a strong password and does not store it in GitHub or shell
history.
