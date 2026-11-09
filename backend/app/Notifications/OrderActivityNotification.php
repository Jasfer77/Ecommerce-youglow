<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderActivityNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public readonly string $orderNumber,
        public readonly string $title,
        public readonly string $message,
        public readonly string $actionUrl,
        public readonly string $actionLabel = 'View order',
    ) {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->title.' · '.$this->orderNumber)
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->message)
            ->line('Order: '.$this->orderNumber)
            ->action($this->actionLabel, $this->actionUrl)
            ->line('This is an automated update from You Glow Cebu Beauty & Wellness.');
    }
}
