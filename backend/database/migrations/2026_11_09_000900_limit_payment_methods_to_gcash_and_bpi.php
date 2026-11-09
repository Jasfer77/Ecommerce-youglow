<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('payment_methods')->where('code','cash_on_delivery')->delete();
        DB::table('payment_methods')->where('code','bank_transfer')->update([
            'name'=>'BPI',
            'bank_name'=>'Bank of the Philippine Islands (BPI)',
            'instructions'=>'Transfer the full payment to the BPI account shown and upload your receipt with its reference number.',
            'requires_receipt'=>true,
            'is_active'=>true,
            'sort_order'=>2,
            'updated_at'=>now(),
        ]);
        Cache::forget('public.payment-methods.v1');
    }

    public function down(): void
    {
        DB::table('payment_methods')->where('code','bank_transfer')->update([
            'name'=>'Bank transfer',
            'bank_name'=>null,
            'instructions'=>'Transfer to the account shown and upload your receipt.',
            'updated_at'=>now(),
        ]);
        DB::table('payment_methods')->updateOrInsert(['code'=>'cash_on_delivery'],[
            'name'=>'Cash on delivery',
            'instructions'=>'Available for selected Cebu delivery areas.',
            'is_active'=>true,
            'requires_receipt'=>false,
            'sort_order'=>3,
            'created_at'=>now(),
            'updated_at'=>now(),
        ]);
        Cache::forget('public.payment-methods.v1');
    }
};
