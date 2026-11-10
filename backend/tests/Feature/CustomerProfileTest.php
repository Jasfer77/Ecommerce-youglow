<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CustomerProfileTest extends TestCase
{
    use DatabaseTransactions;

    public function test_customer_can_save_a_landmark_and_profile_photo(): void
    {
        Storage::fake('local');
        $customer=User::where('email','mia@example.com')->firstOrFail();

        $response=$this->actingAs($customer)->post('/api/auth/profile',[
            '_method'=>'PUT',
            'name'=>$customer->name,
            'email'=>$customer->email,
            'phone'=>$customer->phone,
            'address'=>'Lahug, Cebu City 6000',
            'landmark'=>'Blue gate beside the pharmacy',
            'profile_photo'=>UploadedFile::fake()->image('mia.png',800,800),
        ],['Accept'=>'application/json']);

        $response->assertOk()
            ->assertJsonPath('landmark','Blue gate beside the pharmacy')
            ->assertJsonPath('profilePhotoUrl','/api/auth/profile-photo');

        $customer->refresh();
        Storage::disk('local')->assertExists($customer->profile_photo_path);
        $this->actingAs($customer)->get('/api/auth/profile-photo')->assertOk()->assertHeader('Cache-Control','max-age=0, no-store, private');
    }

    public function test_customer_can_remove_an_existing_profile_photo(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('profile-photos/existing.jpg','photo');
        $customer=User::where('email','mia@example.com')->firstOrFail();
        $customer->update(['profile_photo_path'=>'profile-photos/existing.jpg']);

        $this->actingAs($customer)->putJson('/api/auth/profile',[
            'name'=>$customer->name,
            'email'=>$customer->email,
            'phone'=>$customer->phone,
            'address'=>$customer->address,
            'landmark'=>'Near the barangay hall',
            'remove_profile_photo'=>true,
        ])->assertOk()->assertJsonPath('profilePhotoUrl',null);

        Storage::disk('local')->assertMissing('profile-photos/existing.jpg');
    }
}
