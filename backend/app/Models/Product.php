<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = ['category_id', 'sku', 'name', 'slug', 'description', 'price', 'weight_kg', 'images', 'attributes', 'is_active'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'weight_kg' => 'decimal:3', 'images' => 'array', 'attributes' => 'array', 'is_active' => 'boolean'];
    }

    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function stocks(): HasMany { return $this->hasMany(ProductStock::class); }
    public function orderItems(): HasMany { return $this->hasMany(OrderItem::class); }
}
