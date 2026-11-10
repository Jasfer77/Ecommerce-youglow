<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessageAttachmentTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_can_send_a_private_photo_with_or_without_text(): void
    {
        Notification::fake();
        Storage::fake('local');
        $customer=User::where('email','mia@example.com')->firstOrFail();

        $response=$this->actingAs($customer)->post('/api/messages',[
            'text'=>'Please review this photo: https://example.com/order',
            'photo'=>UploadedFile::fake()->image('order-photo.png',900,700),
        ],['Accept'=>'application/json']);

        $response->assertCreated()
            ->assertJsonPath('text','Please review this photo: https://example.com/order')
            ->assertJsonPath('attachment.name','order-photo.png');

        $message=Message::findOrFail($response->json('id'));
        Storage::disk('local')->assertExists($message->attachment_path);
        $this->actingAs($customer)->get($response->json('attachment.url'))->assertOk();
    }

    public function test_admin_can_send_a_photo_and_unrelated_customer_cannot_view_it(): void
    {
        Notification::fake();
        Storage::fake('local');
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $admin=User::where('role','admin')->firstOrFail();
        $unrelated=User::factory()->create(['role'=>'client']);

        $response=$this->actingAs($admin)->post('/api/messages',[
            'user_id'=>$customer->id,
            'photo'=>UploadedFile::fake()->image('delivery.jpg',800,800),
        ],['Accept'=>'application/json']);

        $response->assertCreated()->assertJsonPath('text','');
        $this->actingAs($unrelated)->get($response->json('attachment.url'))->assertForbidden();
    }

    public function test_message_attachment_rejects_non_image_files(): void
    {
        $customer=User::where('email','mia@example.com')->firstOrFail();

        $this->actingAs($customer)->post('/api/messages',[
            'photo'=>UploadedFile::fake()->create('document.pdf',100,'application/pdf'),
        ],['Accept'=>'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');
    }
}
