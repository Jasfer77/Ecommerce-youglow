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

Route::get('/', function () {
    return response()->file(public_path('index.html'), [
        'Cache-Control' => 'public, max-age=0, must-revalidate',
    ]);
});

Route::get('/shop', function () {
    return response()->file(public_path('shop.html'), [
        'Cache-Control' => 'public, max-age=0, must-revalidate',
    ]);
});

Route::get('/products', function () {
    return response()->file(public_path('shop.html'), [
        'Cache-Control' => 'public, max-age=0, must-revalidate',
    ]);
});

Route::get('/account', function () {
    $html = file_get_contents(public_path('account.html'));
    $html = str_replace(['account-modern.css?v=31','account.js?v=32'], ['account-modern.css?v=55','account.js?v=58'], $html);
    return response($html, 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
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

        return response()->json([
            'status' => 'ok',
            'database' => 'ok',
            'storage' => 'ok',
        ], 200, ['Cache-Control' => 'no-store']);
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
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::put('auth/profile', [AuthController::class, 'update']);

    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store']);
    Route::patch('orders/{order}', [OrderController::class, 'update']);
    Route::delete('orders/{order}', [OrderController::class, 'destroy'])->middleware('throttle:10,1');
    Route::post('orders/{order}/confirm-delivery', [OrderController::class, 'confirmDelivery']);
    Route::post('orders/{order}/payment', [OrderController::class, 'submitPayment']);
    Route::get('orders/{order}/receipt', [OrderController::class, 'receipt']);

    Route::get('payment-methods', [PaymentMethodController::class, 'index']);
    Route::get('messages', [MessageController::class, 'index']);
    Route::get('messages/unread-count', [MessageController::class, 'unreadCount']);
    Route::post('messages', [MessageController::class, 'store'])->middleware('throttle:30,1');
});

require __DIR__.'/admin.php';
