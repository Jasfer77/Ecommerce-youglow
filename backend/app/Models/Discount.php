<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Discount extends Model
{
    protected $fillable = ['name', 'code', 'type', 'value', 'target', 'minimum_order_value', 'usage_limit', 'usage_limit_per_user', 'is_active', 'starts_at', 'expires_at'];
    protected function casts(): array { return ['value' => 'decimal:2', 'minimum_order_value' => 'decimal:2', 'is_active' => 'boolean', 'starts_at' => 'datetime', 'expires_at' => 'datetime']; }
    public function users(): BelongsToMany { return $this->belongsToMany(User::class)->withPivot(['times_used', 'last_used_at'])->withTimestamps(); }
}
