<?php

namespace Tests\Feature;

use App\Models\Discount;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class DiscountAdminTest extends TestCase
{
    use DatabaseTransactions;

    public function test_admin_can_create_a_discount_and_assign_it_to_customers(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $customers = User::where('role', 'client')->limit(2)->get();
        $this->assertNotEmpty($customers);

        $response = $this->withSession(['admin_user_id' => $admin->id])->postJson('/api/discounts', [
            'name' => 'Test loyalty reward',
            'code' => 'testreward15',
            'type' => 'percentage',
            'value' => 15,
            'minimum_order_value' => 1000,
            'expires_at' => now()->addMonth()->format('Y-m-d'),
            'is_active' => true,
            'customer_ids' => $customers->pluck('id')->all(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('code', 'TESTREWARD15')
            ->assertJsonCount($customers->count(), 'customers');

        $discount = Discount::where('code', 'TESTREWARD15')->firstOrFail();
        $this->assertEqualsCanonicalizing($customers->pluck('id')->all(), $discount->users()->pluck('users.id')->all());
    }

    public function test_percentage_discount_cannot_exceed_one_hundred(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $customer = User::where('role', 'client')->firstOrFail();

        $this->withSession(['admin_user_id' => $admin->id])->postJson('/api/discounts', [
            'name' => 'Invalid reward',
            'code' => 'INVALID101',
            'type' => 'percentage',
            'value' => 101,
            'customer_ids' => [$customer->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('value');
    }

    public function test_assigned_customer_can_quote_and_apply_a_promo_code(): void
    {
        Notification::fake();
        $customer=User::where('role','client')->firstOrFail();
        $product=Product::where('is_active',true)->whereHas('stocks',fn($query)=>$query->where('quantity','>',0))->firstOrFail();
        $discount=Discount::create(['name'=>'Checkout test reward','code'=>'CHECKOUT20','type'=>'percentage','value'=>20,'target'=>'assigned','minimum_order_value'=>0,'usage_limit_per_user'=>1,'is_active'=>true,'expires_at'=>now()->addMonth()]);
        $discount->users()->attach($customer->id);

        $quote=$this->actingAs($customer)->postJson('/api/discounts/quote',['code'=>'checkout20','items'=>[['id'=>$product->id,'quantity'=>1]]])
            ->assertOk()
            ->assertJsonPath('code','CHECKOUT20');
        $this->assertEquals(round((float)$product->price*.2,2),$quote->json('discountAmount'));

        $placed=$this->actingAs($customer)->postJson('/api/orders',['customer'=>$customer->name,'email'=>$customer->email,'phone'=>$customer->phone,'address'=>$customer->address?:'Cebu City','landmark'=>'Near Cebu City Hall','region'=>'Cebu / Local','postal'=>'6000','promo_code'=>'CHECKOUT20','items'=>[['id'=>$product->id,'quantity'=>1]]])
            ->assertCreated();

        $this->assertEquals(round((float)$product->price*.2,2),$placed->json('discountAmount'));
        $this->assertDatabaseHas('discount_user',['discount_id'=>$discount->id,'user_id'=>$customer->id,'times_used'=>1]);
    }

    public function test_customer_cannot_apply_a_promo_assigned_to_someone_else(): void
    {
        $customers=User::where('role','client')->limit(2)->get();
        $this->assertCount(2,$customers);
        $product=Product::where('is_active',true)->firstOrFail();
        $discount=Discount::create(['name'=>'Private reward','code'=>'PRIVATE10','type'=>'percentage','value'=>10,'target'=>'assigned','minimum_order_value'=>0,'usage_limit_per_user'=>1,'is_active'=>true]);
        $discount->users()->attach($customers->last()->id);

        $this->actingAs($customers->first())->postJson('/api/discounts/quote',['code'=>'PRIVATE10','items'=>[['id'=>$product->id,'quantity'=>1]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('promo_code');
    }
}
