<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderActivityNotification;
use App\Notifications\SupportMessageNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class EmailNotificationService
{
    public function adminsForOrder(Order $order, string $title, string $message): void
    {
        Notification::send(
            User::where('role', 'admin')->whereNotNull('email')->get(),
            new OrderActivityNotification(
                $order->order_number,
                $title,
                $message,
                url('/admin#orders'),
                'Open admin orders',
            ),
        );
    }

    public function customerForOrder(Order $order, string $title, string $message): void
    {
        $customer = $order->user;

        if (! $customer?->email) {
            return;
        }

        $customer->notify(new OrderActivityNotification(
            $order->order_number,
            $title,
            $message,
            url('/account?panel=orders'),
            'View my order',
        ));
    }

    public function adminsForMessage(User $customer, string $message): void
    {
        Notification::send(
            User::where('role', 'admin')->whereNotNull('email')->get(),
            new SupportMessageNotification(
                $customer->name,
                Str::limit(trim($message), 180),
                url('/admin#messages'),
            ),
        );
    }

    public function customerForMessage(User $customer, User $admin, string $message): void
    {
        if (! $customer->email) {
            return;
        }

        $customer->notify(new SupportMessageNotification(
            $admin->name.' from You Glow Cebu',
            Str::limit(trim($message), 180),
            url('/account?panel=messages'),
        ));
    }
}
