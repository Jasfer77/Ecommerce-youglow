<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 80);
            $table->string('account_name')->nullable();
            $table->string('account_number', 100)->nullable();
            $table->string('bank_name')->nullable();
            $table->text('instructions')->nullable();
            $table->string('qr_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('requires_receipt')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
        DB::table('payment_methods')->insert([
            ['code'=>'gcash','name'=>'GCash','instructions'=>'Scan the QR code or send payment to the account shown.','is_active'=>true,'requires_receipt'=>true,'sort_order'=>1,'created_at'=>now(),'updated_at'=>now()],
            ['code'=>'bank_transfer','name'=>'Bank transfer','instructions'=>'Transfer to the account shown and upload your receipt.','is_active'=>true,'requires_receipt'=>true,'sort_order'=>2,'created_at'=>now(),'updated_at'=>now()],
            ['code'=>'cash_on_delivery','name'=>'Cash on delivery','instructions'=>'Available for selected Cebu delivery areas.','is_active'=>true,'requires_receipt'=>false,'sort_order'=>3,'created_at'=>now(),'updated_at'=>now()],
        ]);
    }
    public function down(): void { Schema::dropIfExists('payment_methods'); }
};
