<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    protected $fillable=['code','name','account_name','account_number','bank_name','instructions','qr_path','is_active','requires_receipt','sort_order'];
    protected function casts(): array { return ['is_active'=>'boolean','requires_receipt'=>'boolean']; }
}
