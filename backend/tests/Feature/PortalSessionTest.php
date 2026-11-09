<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class PortalSessionTest extends TestCase
{
    use DatabaseTransactions;

    public function test_admin_and_customer_can_stay_signed_in_in_the_same_browser_session(): void
    {
        $this->withHeader('X-YG-Portal', 'customer')
            ->postJson('/api/auth/login', ['email' => 'mia@example.com', 'password' => 'demo1234'])
            ->assertOk()
            ->assertJsonPath('role', 'client');

        $this->withHeader('X-YG-Portal', 'admin')
            ->postJson('/api/auth/login', ['email' => 'admin@youglow.test', 'password' => 'admin1234'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');

        $this->withHeader('X-YG-Portal', 'customer')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'mia@example.com');

        $this->withHeader('X-YG-Portal', 'admin')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'admin@youglow.test');
    }
}
