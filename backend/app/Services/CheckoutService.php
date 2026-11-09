<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function create(array $data, $user=null, ?string $receiptPath=null): Order
    {
        return DB::transaction(function() use($data,$user,$receiptPath) {
            $subtotal=0; $lines=[];
            foreach($data['items'] as $item) {
                $product=Product::whereKey($item['id'])->where('is_active',true)->lockForUpdate()->firstOrFail();
                $stocks=$product->stocks()->where('quantity','>',0)->orderBy('expiry_date')->lockForUpdate()->get();
                $quantity=(int)$item['quantity']; $available=(int)$stocks->sum('quantity');
                if($quantity<1 || $quantity>$available) throw ValidationException::withMessages(['items'=>"Insufficient stock for {$product->name}."]);
                $line=(float)$product->price*$quantity; $subtotal+=$line; $lines[]=[$product,$stocks,$quantity,$line];
            }
            $order=Order::create(['user_id'=>$user?->id,'order_number'=>'PENDING-'.Str::uuid(),'customer_name'=>$data['customer'],'customer_email'=>$data['email'],'customer_phone'=>$data['phone'],'subtotal'=>$subtotal,'discount_amount'=>0,'shipping_amount'=>0,'total_amount'=>$subtotal,'payment_method'=>'To be selected','payment_status'=>'awaiting_selection','delivery_status'=>'pending','workflow_status'=>'awaiting_admin_review','shipping_address'=>['address'=>$data['address'],'landmark'=>$data['landmark'] ?? null,'region'=>$data['region'] ?? null,'postal'=>$data['postal'] ?? null],'address_confirmed_at'=>now(),'receipt_path'=>null]);
            $order->update(['order_number'=>'YGC-'.now()->format('ymd').'-'.str_pad((string)$order->id,6,'0',STR_PAD_LEFT)]);
            foreach($lines as [$product,$stocks,$quantity,$line]) {
                $order->items()->create(['product_id'=>$product->id,'product_name'=>$product->name,'sku'=>$product->sku,'quantity'=>$quantity,'unit_price'=>$product->price,'line_total'=>$line,'attributes'=>$product->attributes]);
                $remaining=$quantity;
                foreach($stocks as $stock) { $used=min($remaining,$stock->quantity); $stock->decrement('quantity',$used); $remaining-=$used; if(!$remaining) break; }
            }
            return $order->load('items');
        });
    }
}
