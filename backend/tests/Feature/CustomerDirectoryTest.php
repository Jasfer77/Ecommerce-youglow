<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CustomerDirectoryTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_directory_is_admin_only_and_includes_export_fields(): void
    {
        $customer=User::where('role','client')->firstOrFail();
        $customer->update(['address'=>'Cebu City','landmark'=>'Near City Hall','marketing_consent'=>true]);

        $this->getJson('/api/clients')->assertUnauthorized();

        $admin=User::where('role','admin')->firstOrFail();
        $response=$this->withSession(['admin_user_id'=>$admin->id])->getJson('/api/clients')->assertOk();
        $record=collect($response->json())->firstWhere('userId',$customer->id);

        $this->assertSame('Cebu City',$record['address']);
        $this->assertSame('Near City Hall',$record['landmark']);
        $this->assertTrue($record['marketingConsent']);
        $this->assertNotEmpty($record['registeredAt']);
    }
}
