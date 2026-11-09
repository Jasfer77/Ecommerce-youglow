<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerFeedback extends Model
{
    protected $table = 'customer_feedback';

    protected $fillable = ['user_id', 'customer_name', 'rating', 'comment', 'is_approved', 'submitted_at'];

    protected function casts(): array
    {
        return ['rating'=>'integer', 'is_approved'=>'boolean', 'submitted_at'=>'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
