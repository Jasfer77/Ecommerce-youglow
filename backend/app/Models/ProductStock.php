<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStock extends Model
{
    protected $fillable = ['product_id', 'batch_number', 'quantity', 'expiry_date'];
    protected function casts(): array { return ['expiry_date' => 'date']; }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
