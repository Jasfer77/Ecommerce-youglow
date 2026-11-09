# Production launch checklist

The live web root must point to this project's `public` directory, never to the
Laravel project root.

## Server requirements

- PHP 8.2 or newer with PDO MySQL, OpenSSL, Mbstring, Tokenizer, XML, Ctype,
  JSON, BCMath and Fileinfo
- MySQL 8+
- Apache with `mod_rewrite`, `mod_headers`, `mod_expires` and `mod_deflate`, or
  equivalent Nginx rules
- HTTPS certificate and automated renewal

## First deployment

1. Copy `.env.production.example` to `.env` and replace every placeholder.
2. Generate the key once: `php artisan key:generate`.
3. Install optimized dependencies:
   `composer install --no-dev --prefer-dist --optimize-autoloader`.
4. Run `php artisan migrate --force`.
5. Run `php artisan storage:link`.
6. Run `php artisan optimize`.
7. Ensure the web-server user can write only to `storage` and
   `bootstrap/cache`.
8. Start a supervised queue worker:
   `php artisan queue:work --sleep=3 --tries=3 --max-time=3600`.
9. Add a cron entry that runs `php artisan schedule:run` every minute.
10. Configure uptime monitoring for `/health`; HTTP 200 means the database and
    writable storage are available.

## Every deployment

1. Enable maintenance mode: `php artisan down --retry=60`.
2. Install dependencies and run `php artisan migrate --force`.
3. Rebuild caches with `php artisan optimize`.
4. Restart the supervised queue workers with `php artisan queue:restart`.
5. Disable maintenance mode: `php artisan up`.
6. Check `/health`, customer login, admin login, cart, checkout, messaging,
   receipt upload/viewing, and one test order through completion.

## Reliability essentials

- Take encrypted daily database backups and test restoring one before launch.
- Back up uploaded product images and payment receipts separately.
- Keep at least seven daily and four weekly backups outside the live server.
- Monitor HTTP errors, queue failures, disk usage, database capacity and TLS
  expiry.
- Configure a transactional SMTP provider in `.env`. Order and support-message
  emails use the database queue, so the supervised queue worker must always be
  running. Monitor `failed_jobs` and retry resolved failures with
  `php artisan queue:retry all`.
- Product images and receipts are converted to bounded JPEGs, and payment
  QR codes to lossless PNGs. Alert before disk usage reaches 80%; for a large
  customer base, move uploads to private/public S3-compatible object storage
  and apply a receipt-retention policy approved by the business.
- Never expose `.env`, `storage`, database exports or application logs through
  the web server.
