<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = ['user_id', 'order_number', 'customer_name', 'customer_email', 'customer_phone', 'subtotal', 'discount_amount', 'shipping_amount', 'total_amount', 'payment_method', 'payment_status', 'delivery_status', 'workflow_status', 'delivery_fee_payment', 'address_confirmed_at', 'shipping_address', 'billing_address', 'receipt_path', 'payment_reference', 'rejection_reason', 'archived_at'];
    protected function casts(): array { return ['subtotal' => 'decimal:2', 'discount_amount' => 'decimal:2', 'shipping_amount' => 'decimal:2', 'total_amount' => 'decimal:2', 'shipping_address' => 'array', 'billing_address' => 'array', 'address_confirmed_at' => 'datetime', 'archived_at' => 'datetime']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class); }
    public function feedback(): HasMany { return $this->hasMany(CustomerFeedback::class); }
}
