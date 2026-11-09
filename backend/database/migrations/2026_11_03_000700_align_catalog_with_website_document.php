<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function (): void {
            $catalog = [
                ['legacy' => 'TRZZ-001', 'sku' => 'TRZ15-001', 'short' => 'TRZ 15', 'name' => 'Tirzepatide 15 mg', 'category' => 'Weight Management', 'price' => 3490, 'stock' => 18, 'batch' => 'TRZ15-2610', 'expiry' => '2027-10-16', 'tone' => 'peach', 'description' => 'Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
                ['legacy' => null, 'sku' => 'TRZ30-001', 'short' => 'TRZ 30', 'name' => 'Tirzepatide 30 mg', 'category' => 'Weight Management', 'price' => 5490, 'stock' => 12, 'batch' => 'TRZ30-2610', 'expiry' => '2027-10-16', 'tone' => 'peach', 'description' => 'Supports weight management in eligible adults alongside appropriate lifestyle changes.'],
                ['legacy' => 'GHK-CU-001', 'sku' => 'GHK-CU-001', 'short' => 'GHK-CU', 'name' => 'GHK-Cu 50 mg', 'category' => 'Skin & Beauty', 'price' => 2890, 'stock' => 9, 'batch' => 'GHK-2608', 'expiry' => '2027-05-12', 'tone' => 'sage', 'description' => 'A copper-binding peptide studied for its potential role in skin health, collagen processes, and tissue repair.'],
                ['legacy' => 'NADP-001', 'sku' => 'NADP-001', 'short' => 'NAD+', 'name' => 'NAD+ 50 mg', 'category' => 'Cellular Wellness', 'price' => 3190, 'stock' => 5, 'batch' => 'NAD-2607', 'expiry' => '2027-02-08', 'tone' => 'rose', 'description' => 'Supports cellular energy metabolism, normal cell function, and healthy ageing processes.'],
            ];

            $activeSkus = [];
            foreach ($catalog as $item) {
                $categoryId = DB::table('categories')->where('slug', Str::slug($item['category']))->value('id');
                if (! $categoryId) {
                    $categoryId = DB::table('categories')->insertGetId(['name' => $item['category'], 'slug' => Str::slug($item['category']), 'created_at' => now(), 'updated_at' => now()]);
                }

                $productId = DB::table('products')->where('sku', $item['sku'])->value('id');
                if (! $productId && $item['legacy']) {
                    $productId = DB::table('products')->where('sku', $item['legacy'])->value('id');
                }

                $values = [
                    'category_id' => $categoryId,
                    'sku' => $item['sku'],
                    'name' => $item['name'],
                    'slug' => Str::slug($item['name']),
                    'description' => $item['description'],
                    'price' => $item['price'],
                    'weight_kg' => .25,
                    'images' => '[]',
                    'attributes' => json_encode(['short' => $item['short'], 'tone' => $item['tone']]),
                    'is_active' => true,
                    'updated_at' => now(),
                ];

                if ($productId) {
                    DB::table('products')->where('id', $productId)->update($values);
                } else {
                    $productId = DB::table('products')->insertGetId($values + ['created_at' => now()]);
                }

                DB::table('product_stocks')->updateOrInsert(
                    ['product_id' => $productId, 'batch_number' => $item['batch']],
                    ['quantity' => $item['stock'], 'expiry_date' => $item['expiry'], 'created_at' => now(), 'updated_at' => now()]
                );
                $activeSkus[] = $item['sku'];
            }

            DB::table('products')->whereNotIn('sku', $activeSkus)->update(['is_active' => false, 'updated_at' => now()]);
        });
    }

    public function down(): void
    {
        DB::table('products')->where('sku', 'TRZ30-001')->update(['is_active' => false]);
    }
};
