<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('customer_feedback')
            ->whereNull('user_id')
            ->whereIn('comment', [
                'The team explained the order process clearly and kept me updated through messages.',
                'My questions were answered patiently, and the whole experience felt personal and organized.',
                'I appreciated the thoughtful support from product selection until my order arrived.',
            ])
            ->delete();
    }

    public function down(): void
    {
        // Sample testimonials are intentionally not restored.
    }
};
