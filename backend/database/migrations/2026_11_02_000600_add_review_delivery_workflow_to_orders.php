<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('workflow_status', 40)->default('awaiting_admin_review')->after('delivery_status')->index();
            $table->string('delivery_fee_payment', 30)->nullable()->after('workflow_status');
            $table->timestamp('address_confirmed_at')->nullable()->after('delivery_fee_payment');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['workflow_status']);
            $table->dropColumn(['workflow_status', 'delivery_fee_payment', 'address_confirmed_at']);
        });
    }
};
