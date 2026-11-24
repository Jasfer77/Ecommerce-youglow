<?php

namespace Tests\Feature;

use App\Models\CustomerFeedback;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CustomerFeedbackTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_can_review_and_update_a_delivered_order(): void
    {
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $order=$this->orderFor($customer,'delivered');

        $this->actingAs($customer)->postJson('/api/feedback',[
            'order_id'=>$order->id,
            'rating'=>4,
            'comment'=>'The order arrived safely and the support was helpful.',
        ])->assertCreated()
            ->assertJsonPath('orderId',$order->id)
            ->assertJsonPath('rating',4);

        $this->actingAs($customer)->postJson('/api/feedback',[
            'order_id'=>$order->id,
            'rating'=>5,
            'comment'=>'Everything arrived safely and the service was excellent.',
        ])->assertOk()->assertJsonPath('rating',5);

        $this->assertSame(1,CustomerFeedback::where('order_id',$order->id)->count());
        $this->assertDatabaseHas('customer_feedback',[
            'order_id'=>$order->id,
            'user_id'=>$customer->id,
            'rating'=>5,
            'is_approved'=>false,
        ]);

        Cache::forget('public.feedback.v1');
        $this->getJson('/api/feedback')->assertOk()
            ->assertJsonMissing(['comment'=>'Everything arrived safely and the service was excellent.']);

        $admin=User::where('role','admin')->firstOrFail();
        $feedback=CustomerFeedback::where('order_id',$order->id)->firstOrFail();
        $this->withSession(['admin_user_id'=>$admin->id])->getJson('/api/admin-feedback')->assertOk()
            ->assertJsonFragment(['id'=>$feedback->id,'approved'=>false]);
        $this->withSession(['admin_user_id'=>$admin->id])->patchJson("/api/admin-feedback/{$feedback->id}",[
            'approved'=>true,
        ])->assertOk()->assertJsonPath('approved',true);

        Cache::forget('public.feedback.v1');
        $this->getJson('/api/feedback')->assertOk()
            ->assertJsonFragment(['customer'=>'Mia S.','rating'=>5]);
    }

    public function test_customer_cannot_review_an_undelivered_order_or_another_customers_order(): void
    {
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $other=User::where('role','client')->whereKeyNot($customer->id)->first()
            ?? User::factory()->create(['role'=>'client']);

        $pending=$this->orderFor($customer,'pending');
        $this->actingAs($customer)->postJson('/api/feedback',[
            'order_id'=>$pending->id,'rating'=>5,'comment'=>'This should not be accepted.',
        ])->assertStatus(422);

        $delivered=$this->orderFor($other,'delivered');
        $this->actingAs($customer)->postJson('/api/feedback',[
            'order_id'=>$delivered->id,'rating'=>5,'comment'=>'This is not my order.',
        ])->assertNotFound();
    }

    public function test_customer_can_attach_review_photos_to_a_delivered_order(): void
    {
        Storage::fake('local');
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $order=$this->orderFor($customer,'delivered');

        $response=$this->actingAs($customer)->post('/api/feedback',[
            'order_id'=>$order->id,
            'rating'=>5,
            'comment'=>'The products arrived safely and looked exactly as expected.',
            'photos'=>[
                UploadedFile::fake()->image('delivery.jpg',900,900),
                UploadedFile::fake()->image('products.png',700,700),
            ],
        ],['Accept'=>'application/json']);

        $response->assertCreated()->assertJsonCount(2,'photos');
        $feedback=CustomerFeedback::where('order_id',$order->id)->firstOrFail();
        $this->assertCount(2,$feedback->photo_paths);
        foreach($feedback->photo_paths as $path) Storage::disk('local')->assertExists($path);
    }

    private function orderFor(User $customer,string $deliveryStatus): Order
    {
        return Order::create([
            'user_id'=>$customer->id,
            'order_number'=>'YGC-TEST-'.str()->upper(str()->random(10)),
            'customer_name'=>$customer->name,
            'customer_email'=>$customer->email,
            'customer_phone'=>$customer->phone,
            'subtotal'=>1000,
            'discount_amount'=>0,
            'shipping_amount'=>150,
            'total_amount'=>1150,
            'payment_method'=>'GCash',
            'payment_status'=>'verified',
            'delivery_status'=>$deliveryStatus,
            'workflow_status'=>$deliveryStatus==='delivered'?'completed':'awaiting_admin_review',
            'shipping_address'=>['address'=>'Cebu City'],
        ]);
    }
}
