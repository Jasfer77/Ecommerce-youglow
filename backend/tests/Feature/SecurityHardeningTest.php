<?php

namespace Tests\Feature;

use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
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

    public function test_customer_qr_and_public_product_images_are_served_without_storage_symlinks(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Cache::forget('public.payment-methods.v2');
        Cache::forget('public.products.v2');
        $customer=User::where('role','client')->firstOrFail();
        $method=PaymentMethod::where('is_active',true)->firstOrFail();
        $method->update(['qr_path'=>'payment-qr/test.png']);
        Storage::disk('local')->put('payment-qr/test.png','qr-image');

        $methods=$this->withSession(['customer_user_id'=>$customer->id])
            ->getJson('/api/payment-methods?portal=customer')->assertOk();
        $qrUrl=collect($methods->json())->firstWhere('id',$method->id)['qrUrl'];
        $this->withSession(['customer_user_id'=>$customer->id])->get($qrUrl)
            ->assertOk()->assertHeader('Content-Type','image/png');

        $admin=User::where('role','admin')->firstOrFail();
        $adminMethods=$this->withSession(['admin_user_id'=>$admin->id])
            ->getJson('/api/payment-methods?portal=admin')->assertOk();
        $adminQrUrl=collect($adminMethods->json())->firstWhere('id',$method->id)['qrUrl'];
        $this->withSession(['admin_user_id'=>$admin->id])->get($adminQrUrl)
            ->assertOk()->assertHeader('Content-Type','image/png');

        $product=Product::where('is_active',true)->firstOrFail();
        $product->update(['images'=>['products/test.jpg']]);
        Storage::disk('public')->put('products/test.jpg',base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=='));
        $this->get(route('products.image',$product,absolute:false))->assertOk();
    }

    public function test_public_product_catalog_does_not_expose_inventory_records(): void
    {
        Cache::forget('public.products.v2');

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
