<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\SupportMessageNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EmailNotificationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_message_notifies_admins_and_admin_reply_notifies_customer(): void
    {
        Notification::fake();
        $customer = User::where('email', 'mia@example.com')->firstOrFail();
        $admin = User::where('role', 'admin')->firstOrFail();

        $this->actingAs($customer)
            ->postJson('/api/messages', ['text' => 'Can you help with my order?'])
            ->assertCreated();

        Notification::assertSentTo($admin, SupportMessageNotification::class);

        $this->actingAs($admin)
            ->postJson('/api/messages', ['user_id' => $customer->id, 'text' => 'Yes, we are reviewing it now.'])
            ->assertCreated();

        Notification::assertSentTo($customer, SupportMessageNotification::class);
    }
}
