<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use DatabaseTransactions;

    public function test_sensitive_payment_details_require_authentication(): void
    {
        $this->getJson('/api/payment-methods')->assertUnauthorized();

        $customer = User::where('role', 'client')->firstOrFail();
        $this->actingAs($customer)
            ->getJson('/api/payment-methods')
            ->assertOk()
            ->assertJsonStructure([['name', 'accountName', 'accountNumber']]);
    }

    public function test_public_product_catalog_does_not_expose_inventory_records(): void
    {
        Cache::forget('public.products.v1');

        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonMissingPath('0.sku')
            ->assertJsonMissingPath('0.stock')
            ->assertJsonMissingPath('0.batch')
            ->assertJsonMissingPath('0.expiry')
            ->assertJsonStructure([['id', 'name', 'price', 'inStock']]);
    }

    public function test_security_headers_are_added_to_web_responses(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            ->assertHeader('Content-Security-Policy');
    }

    public function test_live_account_response_does_not_prefill_demo_credentials(): void
    {
        $this->get('/account')
            ->assertOk()
            ->assertDontSee('value="mia@example.com"', false)
            ->assertDontSee('value="demo1234"', false)
            ->assertDontSee('Testing account credentials are prefilled.', false);
    }
}
