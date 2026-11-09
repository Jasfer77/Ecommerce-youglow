<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\CustomerPasswordResetNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerPasswordResetTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_can_reset_password_with_one_time_verification_code(): void
    {
        Notification::fake();
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $code=null;

        $this->postJson('/api/auth/forgot-password',['email'=>'mia@example.com'])
            ->assertOk()
            ->assertJsonFragment(['message'=>'If that email belongs to a customer account, a six-digit verification code has been sent.']);

        Notification::assertSentTo($customer,CustomerPasswordResetNotification::class,function($notification) use (&$code) {
            $code=$notification->code;
            return preg_match('/^\d{6}$/',$code)===1;
        });

        $this->postJson('/api/auth/reset-password',[
            'email'=>'mia@example.com',
            'code'=>$code,
            'password'=>'new-secure-password',
            'password_confirmation'=>'new-secure-password',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-secure-password',$customer->fresh()->password));
        $this->assertDatabaseMissing('password_reset_tokens',['email'=>'mia@example.com']);
    }

    public function test_unknown_and_admin_emails_do_not_receive_customer_reset_codes(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password',['email'=>'unknown@example.com'])->assertOk();
        $this->postJson('/api/auth/forgot-password',['email'=>'admin@youglow.test'])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_invalid_verification_code_cannot_change_password(): void
    {
        $this->postJson('/api/auth/reset-password',[
            'email'=>'mia@example.com',
            'code'=>'000000',
            'password'=>'new-secure-password',
            'password_confirmation'=>'new-secure-password',
        ])->assertUnprocessable()
            ->assertJsonFragment(['message'=>'The verification code is invalid or has expired. Request a new code and try again.']);
    }
}
