<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerPasswordResetNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly string $code)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your You Glow Cebu verification code')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('We received a request to reset your customer account password.')
            ->line('Your one-time verification code is:')
            ->line($this->code)
            ->line('Enter this code on the customer sign-in page. It expires in 10 minutes and can only be used once.')
            ->line('If you did not request this change, you can safely ignore this email.');
    }
}
