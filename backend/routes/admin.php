<?php

use App\Http\Controllers\Admin\PageController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\DiscountController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PaymentMethodController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('login', [PageController::class, 'login'])->name('login');
    Route::get('/', [PageController::class, 'dashboard'])->middleware('admin.portal')->name('dashboard');
});

// These URLs remain unchanged so the current dashboard JavaScript keeps working.
// They are grouped here because only administrators may use them.
Route::prefix('api')->middleware('admin.portal')->group(function () {
    Route::post('products', [ProductController::class, 'store']);
    Route::put('products/{product}', [ProductController::class, 'update']);
    Route::patch('products/{product}/visibility', [ProductController::class, 'visibility']);
    Route::delete('products/{product}', [ProductController::class, 'destroy']);

    Route::get('clients', [MessageController::class, 'clients']);
    Route::post('clients', [MessageController::class, 'storeClient']);

    Route::get('admins', [AdminController::class, 'index']);
    Route::post('admins', [AdminController::class, 'store']);
    Route::put('admins/{admin}', [AdminController::class, 'update']);

    Route::post('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);

    Route::get('discounts', [DiscountController::class, 'index']);
    Route::post('discounts', [DiscountController::class, 'store']);
    Route::put('discounts/{discount}', [DiscountController::class, 'update']);
    Route::delete('discounts/{discount}', [DiscountController::class, 'destroy']);
});
