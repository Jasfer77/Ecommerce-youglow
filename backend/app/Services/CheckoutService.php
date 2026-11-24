<?php

namespace App\Services;

use App\Models\Discount;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function quoteDiscount(array $items, User $user, string $code): array
    {
        $subtotal=0;
        foreach($items as $item) {
            $product=Product::whereKey($item['id'])->where('is_active',true)->firstOrFail();
            $quantity=(int)$item['quantity'];
            if($quantity<1) throw ValidationException::withMessages(['items'=>'Each product quantity must be at least one.']);
            $subtotal+=(float)$product->price*$quantity;
        }

        [$discount,$amount]=$this->resolveDiscount($user,$code,$subtotal);
        return ['code'=>$discount->code,'name'=>$discount->name,'discountAmount'=>$amount,'subtotal'=>$subtotal,'total'=>max(0,$subtotal-$amount)];
    }

    public function create(array $data, $user=null, ?string $receiptPath=null): Order
    {
        $order=DB::transaction(function() use($data,$user,$receiptPath) {
            $subtotal=0; $lines=[];
            $requested=[];
            foreach($data['items'] as $item) {
                $productId=(int)$item['id'];
                $requested[$productId]=($requested[$productId]??0)+(int)$item['quantity'];
            }
            foreach($requested as $productId=>$quantity) {
                $product=Product::whereKey($productId)->where('is_active',true)->lockForUpdate()->firstOrFail();
                $stocks=$product->stocks()->where('quantity','>',0)->orderBy('expiry_date')->lockForUpdate()->get();
                $available=(int)$stocks->sum('quantity');
                if($quantity<1 || $quantity>$available) {
                    $message=$available===0
                        ? "{$product->name} is out of stock and cannot be checked out."
                        : "Insufficient stock for {$product->name}. Only {$available} available.";
                    throw ValidationException::withMessages(['items'=>$message]);
                }
                $line=(float)$product->price*$quantity; $subtotal+=$line; $lines[]=[$product,$stocks,$quantity,$line];
            }
            $discount=null; $discountAmount=0;
            if(!empty($data['promo_code'])) [$discount,$discountAmount]=$this->resolveDiscount($user,$data['promo_code'],$subtotal,true);
            $order=Order::create(['user_id'=>$user?->id,'order_number'=>'PENDING-'.Str::uuid(),'customer_name'=>$data['customer'],'customer_email'=>$data['email'],'customer_phone'=>$data['phone'],'subtotal'=>$subtotal,'discount_amount'=>$discountAmount,'shipping_amount'=>0,'total_amount'=>max(0,$subtotal-$discountAmount),'payment_method'=>'To be selected','payment_status'=>'awaiting_selection','delivery_status'=>'pending','workflow_status'=>'awaiting_admin_review','shipping_address'=>['address'=>$data['address'],'landmark'=>$data['landmark'] ?? null,'region'=>$data['region'] ?? null,'postal'=>$data['postal'] ?? null],'address_confirmed_at'=>now(),'receipt_path'=>null]);
            $order->update(['order_number'=>'YGC-'.now()->format('ymd').'-'.str_pad((string)$order->id,6,'0',STR_PAD_LEFT)]);
            foreach($lines as [$product,$stocks,$quantity,$line]) {
                $order->items()->create(['product_id'=>$product->id,'product_name'=>$product->name,'sku'=>$product->sku,'quantity'=>$quantity,'unit_price'=>$product->price,'line_total'=>$line,'attributes'=>$product->attributes]);
                $remaining=$quantity;
                foreach($stocks as $stock) { $used=min($remaining,$stock->quantity); $stock->decrement('quantity',$used); $remaining-=$used; if(!$remaining) break; }
            }
            if($discount) DB::table('discount_user')->where('discount_id',$discount->id)->where('user_id',$user->id)->update(['times_used'=>DB::raw('times_used + 1'),'last_used_at'=>now(),'updated_at'=>now()]);
            return $order->load('items');
        });
        Cache::forget('public.products.v2');
        return $order;
    }

    private function resolveDiscount(?User $user, string $code, float $subtotal, bool $lock=false): array
    {
        if(!$user) throw ValidationException::withMessages(['promo_code'=>'Sign in before applying a promo code.']);
        $normalized=strtoupper(trim($code));
        if($normalized==='') throw ValidationException::withMessages(['promo_code'=>'Enter a promo code.']);
        $query=Discount::where('code',$normalized);
        if($lock) $query->lockForUpdate();
        $discount=$query->first();
        if(!$discount||!$discount->is_active) throw ValidationException::withMessages(['promo_code'=>'This promo code is invalid or inactive.']);
        if($discount->starts_at&&now()->lt($discount->starts_at)) throw ValidationException::withMessages(['promo_code'=>'This promo code is not active yet.']);
        if($discount->expires_at&&now()->startOfDay()->gt($discount->expires_at->copy()->startOfDay())) throw ValidationException::withMessages(['promo_code'=>'This promo code has expired.']);
        if($subtotal<(float)$discount->minimum_order_value) throw ValidationException::withMessages(['promo_code'=>'This promo requires a minimum order of ₱'.number_format((float)$discount->minimum_order_value,0).'.']);

        $pivotQuery=DB::table('discount_user')->where('discount_id',$discount->id)->where('user_id',$user->id);
        if($lock) $pivotQuery->lockForUpdate();
        $assignment=$pivotQuery->first();
        if(!$assignment) throw ValidationException::withMessages(['promo_code'=>'This promo code is not available for your account.']);
        if($discount->usage_limit_per_user!==null&&(int)$assignment->times_used>=(int)$discount->usage_limit_per_user) throw ValidationException::withMessages(['promo_code'=>'You have already used this promo code.']);
        if($discount->usage_limit!==null&&(int)DB::table('discount_user')->where('discount_id',$discount->id)->sum('times_used')>=(int)$discount->usage_limit) throw ValidationException::withMessages(['promo_code'=>'This promo code has reached its usage limit.']);

        $amount=$discount->type==='percentage'?$subtotal*((float)$discount->value/100):(float)$discount->value;
        return [$discount,round(min($subtotal,$amount),2)];
    }
}
