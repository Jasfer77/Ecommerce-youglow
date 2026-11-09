<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name', 120);
            $table->unsignedTinyInteger('rating')->default(5);
            $table->text('comment');
            $table->boolean('is_approved')->default(false)->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });

        DB::table('customer_feedback')->insert([
            ['customer_name'=>'Mia S.','rating'=>5,'comment'=>'The team explained the order process clearly and kept me updated through messages.','is_approved'=>true,'submitted_at'=>now(),'created_at'=>now(),'updated_at'=>now()],
            ['customer_name'=>'Angela R.','rating'=>5,'comment'=>'My questions were answered patiently, and the whole experience felt personal and organized.','is_approved'=>true,'submitted_at'=>now(),'created_at'=>now(),'updated_at'=>now()],
            ['customer_name'=>'Camille D.','rating'=>5,'comment'=>'I appreciated the thoughtful support from product selection until my order arrived.','is_approved'=>true,'submitted_at'=>now(),'created_at'=>now(),'updated_at'=>now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_feedback');
    }
};
