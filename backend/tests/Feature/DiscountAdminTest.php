<?php

namespace Tests\Feature;

use App\Models\Discount;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
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
}
