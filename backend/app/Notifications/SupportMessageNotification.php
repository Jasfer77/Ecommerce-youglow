<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SupportMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public readonly string $senderName,
        public readonly string $preview,
        public readonly string $actionUrl,
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
            ->subject('New message from '.$this->senderName)
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->senderName.' sent a new support message:')
            ->line('“'.$this->preview.'”')
            ->action('Open conversation', $this->actionUrl)
            ->line('For security, reply through the You Glow Cebu website rather than by email.');
    }
}
