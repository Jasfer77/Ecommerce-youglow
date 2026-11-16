<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class RealtimeNotificationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_notification_state_reports_new_messages_for_each_portal(): void
    {
        $customer=User::where('role','client')->firstOrFail();
        $admin=User::where('role','admin')->firstOrFail();
        $conversation=Conversation::firstOrCreate(
            ['user_id'=>$customer->id,'subject'=>'Order support'],
            ['status'=>'open']
        );

        Message::create([
            'conversation_id'=>$conversation->id,
            'sender_id'=>$customer->id,
            'body'=>'Realtime customer message',
        ]);

        $this->actingAs($admin)->getJson('/api/notifications/state')
            ->assertOk()
            ->assertHeader('Cache-Control','max-age=0, no-store, private')
            ->assertJsonPath('unreadMessages',fn($count)=>$count>=1)
            ->assertJsonStructure(['pendingOrders','messagesVersion','ordersVersion']);

        Message::create([
            'conversation_id'=>$conversation->id,
            'sender_id'=>$admin->id,
            'body'=>'Realtime administrator reply',
        ]);

        $this->actingAs($customer)->getJson('/api/notifications/state')
            ->assertOk()
            ->assertJsonPath('unreadMessages',fn($count)=>$count>=1)
            ->assertJsonStructure(['pendingOrders','messagesVersion','ordersVersion']);
    }
}
