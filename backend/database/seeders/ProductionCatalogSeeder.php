<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Discount;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProductionCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            ['TRZ 15', 'Tirzepatide 15 mg', 'Weight Management', 3490, 18, 'TRZ15-2610', '2027-10-16', 'peach', 'Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
            ['TRZ 30', 'Tirzepatide 30 mg', 'Weight Management', 5490, 12, 'TRZ30-2610', '2027-10-16', 'peach', 'Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
            ['GHK-CU', 'GHK-Cu 50 mg', 'Skin & Beauty', 2890, 9, 'GHK-2608', '2027-05-12', 'sage', 'A copper-binding peptide studied for its potential role in skin health, collagen processes, and tissue repair.'],
            ['NAD+', 'NAD+ 50 mg', 'Cellular Wellness', 3190, 5, 'NAD-2607', '2027-02-08', 'rose', 'Supports cellular energy metabolism, normal cell function, and healthy ageing processes.'],
        ];

        foreach ($products as [$short, $name, $categoryName, $price, $quantity, $batch, $expiry, $tone, $description]) {
            $category = Category::firstOrCreate(
                ['slug' => Str::slug($categoryName)],
                ['name' => $categoryName],
            );

            $product = Product::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'category_id' => $category->id,
                    'sku' => str_replace(['+', ' '], ['P', '-'], $short).'-001',
                    'name' => $name,
                    'description' => $description,
                    'price' => $price,
                    'weight_kg' => 0.25,
                    'images' => [],
                    'attributes' => ['short' => $short, 'tone' => $tone],
                    'is_active' => true,
                ],
            );

            $product->stocks()->updateOrCreate(
                ['batch_number' => $batch],
                ['quantity' => $quantity, 'expiry_date' => $expiry],
            );
        }

        Discount::updateOrCreate(
            ['code' => 'NEW10'],
            [
                'name' => 'First order welcome',
                'type' => 'percentage',
                'value' => 10,
                'target' => 'new_client',
                'minimum_order_value' => 1000,
                'usage_limit_per_user' => 1,
                'is_active' => true,
                'expires_at' => '2027-12-31 23:59:59+08',
            ],
        );
    }
}
