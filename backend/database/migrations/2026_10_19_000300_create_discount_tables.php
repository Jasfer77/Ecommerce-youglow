<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable()->unique();
            $table->string('type', 20);
            $table->decimal('value', 12, 2);
            $table->string('target', 20)->default('all')->index();
            $table->decimal('minimum_order_value', 12, 2)->default(0);
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('usage_limit_per_user')->default(1);
            $table->boolean('is_active')->default(true)->index();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('expires_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('discount_user', function (Blueprint $table) {
            $table->foreignId('discount_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('times_used')->default(0);
            $table->timestampTz('last_used_at')->nullable();
            $table->timestamps();
            $table->primary(['discount_id', 'user_id']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('discount_user');
        Schema::dropIfExists('discounts');
    }
};
