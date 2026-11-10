<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PaymentMethodController;
use App\Http\Controllers\CustomerFeedbackController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

$serveSeoPage = function (string $filename) {
    $appUrl = rtrim((string) config('app.url'), '/');
    $html = str_replace('{{APP_URL}}', $appUrl, file_get_contents(public_path($filename)));

    return response($html, 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'public, max-age=0, must-revalidate',
        'X-Robots-Tag' => 'index, follow',
    ]);
};

Route::get('/', fn () => $serveSeoPage('index.html'));

Route::redirect('/shop', '/products', 301);

Route::get('/products', fn () => $serveSeoPage('shop.html'));

Route::get('/robots.txt', function () {
    $appUrl = rtrim((string) config('app.url'), '/');
    $robots = <<<ROBOTS
User-agent: *
Allow: /
Disallow: /account
Disallow: /admin
Disallow: /api/
Disallow: /csrf-token
Disallow: /health

Sitemap: {$appUrl}/sitemap.xml
ROBOTS;

    return response($robots."\n", 200, [
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Cache-Control' => 'public, max-age=3600',
    ]);
});

Route::get('/sitemap.xml', function () {
    $appUrl = htmlspecialchars(
        rtrim((string) config('app.url'), '/'),
        ENT_XML1 | ENT_QUOTES,
        'UTF-8'
    );
    $lastModified = now()->toDateString();
    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{$appUrl}/</loc>
    <lastmod>{$lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{$appUrl}/products</loc>
    <lastmod>{$lastModified}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
XML;

    return response($xml, 200, [
        'Content-Type' => 'application/xml; charset=UTF-8',
        'Cache-Control' => 'public, max-age=3600',
    ]);
});

Route::get('/account', function () {
    $html = file_get_contents(public_path('account.html'));
    $html = str_replace(['account-modern.css?v=35','account.js?v=60'], ['account-modern.css?v=61','account.js?v=61'], $html);
    return response($html, 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Robots-Tag' => 'noindex, nofollow, noarchive',
    ]);
});

Route::get('/health', function () {
    try {
        DB::select('select 1');
        $storageReady = Storage::disk('local')->exists('.gitignore')
            || is_writable(storage_path('app'));

        if (! $storageReady) {
            throw new RuntimeException('Application storage is not writable.');
        }

        return response()->json(['status' => 'ok'], 200, ['Cache-Control' => 'no-store']);
    } catch (Throwable $exception) {
        report($exception);

        return response()->json([
            'status' => 'unhealthy',
        ], 503, ['Cache-Control' => 'no-store']);
    }
});

Route::get('/csrf-token', function () {
    return response()->json(['token' => csrf_token()], 200, [
        'Cache-Control' => 'no-store',
    ]);
})->middleware('throttle:60,1');

Route::prefix('api')->group(function () {
    Route::get('products', [ProductController::class, 'index']);
    Route::get('feedback', [CustomerFeedbackController::class, 'index']);
    Route::post('feedback', [CustomerFeedbackController::class, 'store'])->middleware('throttle:10,1');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::get('auth/profile-photo', [AuthController::class, 'profilePhoto']);
    Route::put('auth/profile', [AuthController::class, 'update']);

    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store']);
    Route::patch('orders/{order}', [OrderController::class, 'update']);
    Route::delete('orders/{order}', [OrderController::class, 'destroy'])->middleware('throttle:10,1');
    Route::post('orders/{order}/confirm-delivery', [OrderController::class, 'confirmDelivery']);
    Route::post('orders/{order}/payment', [OrderController::class, 'submitPayment']);
    Route::get('orders/{order}/receipt', [OrderController::class, 'receipt']);

    Route::get('payment-methods', [PaymentMethodController::class, 'index']);
    Route::get('payment-methods/{paymentMethod}/qr', [PaymentMethodController::class, 'qr'])->name('payment-methods.qr');
    Route::get('messages', [MessageController::class, 'index']);
    Route::get('messages/unread-count', [MessageController::class, 'unreadCount']);
    Route::get('messages/{message}/attachment', [MessageController::class, 'attachment'])->name('messages.attachment');
    Route::post('messages', [MessageController::class, 'store'])->middleware('throttle:30,1');
});

require __DIR__.'/admin.php';
