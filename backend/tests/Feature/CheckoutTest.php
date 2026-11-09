<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Order;
use App\Models\Message;
use App\Models\User;
use App\Notifications\OrderActivityNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_payment_options_are_limited_to_gcash_and_bpi(): void
    {
        Cache::forget('public.payment-methods.v1');
        $customer=User::where('email','mia@example.com')->firstOrFail();

        $this->actingAs($customer)->getJson('/api/payment-methods')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['code'=>'gcash','name'=>'GCash'])
            ->assertJsonFragment(['code'=>'bank_transfer','name'=>'BPI'])
            ->assertJsonMissing(['code'=>'cash_on_delivery']);
    }

    public function test_signed_in_customer_creates_an_order_for_admin_review_before_payment(): void
    {
        Notification::fake();
        $customer = User::where('email', 'mia@example.com')->firstOrFail();
        $admin = User::where('role', 'admin')->firstOrFail();
        $product = Product::where('is_active', true)
            ->whereHas('stocks', fn ($query) => $query->where('quantity', '>', 0))
            ->firstOrFail();

        $response = $this->actingAs($customer)->post('/api/orders', [
            'customer' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'address' => $customer->address ?: 'Cebu City',
            'landmark' => 'Near Cebu City Hall',
            'region' => 'Cebu / Local',
            'postal' => '6000',
            'items' => [['id' => $product->id, 'quantity' => 1]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('payment', 'To be selected')
            ->assertJsonPath('paymentStatus', 'awaiting_selection')
            ->assertJsonPath('workflowStatus', 'awaiting_admin_review')
            ->assertJsonPath('shippingAmount', 0);

        Notification::assertSentTo($admin, OrderActivityNotification::class);
    }

    public function test_online_payment_explains_that_a_receipt_is_required(): void
    {
        $customer = User::where('email', 'mia@example.com')->firstOrFail();
        $product = Product::where('is_active', true)->firstOrFail();

        $placed = $this->actingAs($customer)->post('/api/orders', [
            'customer' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'address' => $customer->address ?: 'Cebu City',
            'landmark' => 'Near Cebu City Hall',
            'region' => 'Cebu / Local',
            'postal' => '6000',
            'items' => [['id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $admin = User::where('role', 'admin')->firstOrFail();
        $orderId = $placed->json('id');
        $this->actingAs($admin)->patch("/api/orders/{$orderId}", ['shipping_amount' => 180])
            ->assertOk()
            ->assertJsonPath('workflowStatus', 'awaiting_address_confirmation');

        $this->actingAs($customer)->post("/api/orders/{$orderId}/confirm-delivery", [
            'delivery_fee_payment' => 'included',
            'address' => $customer->address ?: 'Cebu City',
            'landmark' => 'Near Cebu City Hall',
            'region' => 'Cebu / Local',
            'postal' => '6000',
        ])->assertOk()->assertJsonPath('workflowStatus', 'awaiting_admin_total_confirmation');

        $this->actingAs($admin)->patch("/api/orders/{$orderId}", [
            'workflow_status' => 'awaiting_payment',
        ])->assertOk()->assertJsonPath('workflowStatus', 'awaiting_payment');

        $this->actingAs($customer)->post("/api/orders/{$orderId}/payment", ['payment' => 'GCash'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Please upload proof of payment.');
    }

    public function test_customer_can_cancel_only_a_pending_order_and_stock_is_restored(): void
    {
        $customer = User::where('email', 'mia@example.com')->firstOrFail();
        $product = Product::where('is_active', true)
            ->whereHas('stocks', fn ($query) => $query->where('quantity', '>', 0))
            ->firstOrFail();
        $stockBefore = (int) $product->stocks()->sum('quantity');

        $placed = $this->actingAs($customer)->post('/api/orders', [
            'customer' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'address' => $customer->address ?: 'Cebu City',
            'landmark' => 'Near Cebu City Hall',
            'region' => 'Cebu / Local',
            'postal' => '6000',
            'items' => [['id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $orderId = $placed->json('id');
        $this->patch("/api/orders/{$orderId}", ['delivery_status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('deliveryStatus', 'cancelled')
            ->assertJsonPath('status', 'Cancelled');

        $this->assertSame($stockBefore, (int) $product->stocks()->sum('quantity'));
        $this->assertTrue(Message::where('sender_id',$customer->id)
            ->where('body','like','%'.$placed->json('number').'%')
            ->where('body','like','%cancelled%')
            ->exists());
    }

    public function test_receipt_reference_is_saved_and_admin_can_preview_receipt(): void
    {
        Storage::fake('local');
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $admin=User::where('role','admin')->firstOrFail();
        $product=Product::where('is_active',true)->firstOrFail();

        $placed=$this->actingAs($customer)->post('/api/orders',[
            'customer'=>$customer->name,'email'=>$customer->email,'phone'=>$customer->phone,
            'address'=>$customer->address ?: 'Cebu City','landmark'=>'Near Cebu City Hall','items'=>[['id'=>$product->id,'quantity'=>1]],
        ])->assertCreated();
        $orderId=$placed->json('id');

        $this->actingAs($admin)->patch("/api/orders/{$orderId}",['shipping_amount'=>150])->assertOk();
        $this->actingAs($customer)->post("/api/orders/{$orderId}/confirm-delivery",[
            'delivery_fee_payment'=>'included','address'=>$customer->address ?: 'Cebu City',
        ])->assertOk();
        $this->actingAs($admin)->patch("/api/orders/{$orderId}",['workflow_status'=>'awaiting_payment'])->assertOk();

        $payment=$this->actingAs($customer)->post("/api/orders/{$orderId}/payment",[
            'payment'=>'GCash','payment_reference'=>'GCASH-987654321',
            'receipt'=>UploadedFile::fake()->image('receipt.jpg'),
        ])->assertOk()
            ->assertJsonPath('paymentReference','GCASH-987654321')
            ->assertJsonPath('receiptUrl',"/api/orders/{$orderId}/receipt");

        $this->actingAs($admin)->get($payment->json('receiptUrl'))->assertOk();
    }

    public function test_admin_can_archive_and_restore_an_order_without_changing_its_status(): void
    {
        Notification::fake();
        $admin=User::where('role','admin')->firstOrFail();
        $order=Order::firstOrFail();
        $status=$order->delivery_status;

        $this->actingAs($admin)->patchJson("/api/orders/{$order->id}",['archived'=>true])
            ->assertOk()
            ->assertJsonPath('isArchived',true)
            ->assertJsonPath('deliveryStatus',$status);

        $this->assertNotNull($order->fresh()->archived_at);
        Notification::assertNothingSent();

        $this->actingAs($admin)->patchJson("/api/orders/{$order->id}",['archived'=>false])
            ->assertOk()
            ->assertJsonPath('isArchived',false)
            ->assertJsonPath('deliveryStatus',$status);

        $this->assertNull($order->fresh()->archived_at);
    }

    public function test_admin_can_permanently_delete_an_archived_order(): void
    {
        $admin=User::where('role','admin')->firstOrFail();
        $order=Order::with('items')->firstOrFail();
        $orderId=$order->id;
        $itemIds=$order->items->pluck('id');

        $this->actingAs($admin)->patchJson("/api/orders/{$orderId}",['archived'=>true])
            ->assertOk();

        $this->actingAs($admin)->deleteJson("/api/orders/{$orderId}")
            ->assertOk()
            ->assertJson(['ok'=>true]);

        $this->assertDatabaseMissing('orders',['id'=>$orderId]);
        foreach($itemIds as $itemId) $this->assertDatabaseMissing('order_items',['id'=>$itemId]);
    }
}
