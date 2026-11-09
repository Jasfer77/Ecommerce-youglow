<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('orders')->where('delivery_status', 'delivered')->update(['workflow_status' => 'completed']);
        DB::table('orders')->where('delivery_status', 'cancelled')->update(['workflow_status' => 'cancelled']);
        DB::table('orders')->whereNotIn('delivery_status', ['delivered', 'cancelled'])->where('payment_status', 'verified')->update(['workflow_status' => 'ready_for_fulfillment']);
        DB::table('orders')->whereNotIn('delivery_status', ['delivered', 'cancelled'])->where('payment_status', 'pending_verification')->update(['workflow_status' => 'payment_verification']);
        DB::table('orders')->whereNotIn('delivery_status', ['delivered', 'cancelled'])->where('payment_status', 'cod_pending')->update(['workflow_status' => 'ready_for_fulfillment']);
    }

    public function down(): void
    {
        DB::table('orders')->update(['workflow_status' => 'awaiting_admin_review']);
    }
};
