<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Conversation;
use App\Models\Discount;
use App\Models\Message;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('Demo data cannot be seeded in production. Create the first administrator with the app:create-admin command.');
        }

        $admin=User::updateOrCreate(['email'=>'admin@youglow.test'],['name'=>'Jasfer Admin','phone'=>'0917 000 0001','role'=>'admin','password'=>Hash::make('admin1234')]);
        $mia=User::updateOrCreate(['email'=>'mia@example.com'],['name'=>'Mia Santos','phone'=>'0917 555 0198','address'=>'Lahug, Cebu City 6000','role'=>'client','password'=>Hash::make('demo1234'),'marketing_consent'=>true]);

        $products=[
            ['TRZ 15','Tirzepatide 15 mg','Weight Management',3490,18,'TRZ15-2610','2027-10-16','peach','Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
            ['TRZ 30','Tirzepatide 30 mg','Weight Management',5490,12,'TRZ30-2610','2027-10-16','peach','Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
            ['GHK-CU','GHK-Cu 50 mg','Skin & Beauty',2890,9,'GHK-2608','2027-05-12','sage','A copper-binding peptide studied for its potential role in skin health, collagen processes, and tissue repair.'],
            ['NAD+','NAD+ 50 mg','Cellular Wellness',3190,5,'NAD-2607','2027-02-08','rose','Supports cellular energy metabolism, normal cell function, and healthy ageing processes.'],
        ];
        foreach($products as [$short,$name,$categoryName,$price,$quantity,$batch,$expiry,$tone,$description]) {
            $category=Category::firstOrCreate(['slug'=>Str::slug($categoryName)],['name'=>$categoryName]);
            $product=Product::updateOrCreate(['slug'=>Str::slug($name)],['category_id'=>$category->id,'sku'=>str_replace(['+',' '],['P','-'],$short).'-001','name'=>$name,'description'=>$description,'price'=>$price,'weight_kg'=>0.25,'images'=>[],'attributes'=>['short'=>$short,'tone'=>$tone],'is_active'=>true]);
            $product->stocks()->updateOrCreate(['batch_number'=>$batch],['quantity'=>$quantity,'expiry_date'=>$expiry]);
        }
        Product::whereNotIn('slug',collect($products)->pluck(1)->map(fn($name)=>Str::slug($name)))->update(['is_active'=>false]);

        Discount::updateOrCreate(['code'=>'NEW10'],['name'=>'First order welcome','type'=>'percentage','value'=>10,'target'=>'new_client','minimum_order_value'=>1000,'usage_limit_per_user'=>1,'is_active'=>true,'expires_at'=>'2027-12-31 23:59:59+08']);
        $conversation=Conversation::firstOrCreate(['user_id'=>$mia->id,'subject'=>'Order support'],['status'=>'open']);
        if(!$conversation->messages()->exists()) {
            Message::create(['conversation_id'=>$conversation->id,'sender_id'=>$admin->id,'body'=>'Hi Mia! Welcome to your private You Glow support inbox.']);
            Message::create(['conversation_id'=>$conversation->id,'sender_id'=>$mia->id,'body'=>'Thank you! I am excited to start my wellness journey.']);
        }
    }
}
