<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\PaymentMethod;
use App\Services\CheckoutService;
use App\Services\EmailNotificationService;
use App\Services\ImageStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user(), 401);
        $query=Order::with(['items','user:id,name','feedback'])->latest();
        if($request->user()->role !== 'admin') $query->where('user_id',$request->user()->id);
        return response()->json($query->get()->map(fn($o)=>$this->format($o)));
    }

    public function store(Request $request, CheckoutService $checkout, EmailNotificationService $notifications): JsonResponse
    {
        abort_unless($request->user()?->role==='client',401,'Please sign in as a customer before confirming your order.');
        $data=$request->validate(['customer'=>['required','string','max:120'],'email'=>['required','email'],'phone'=>['required','string','max:32'],'address'=>['required','string','max:1000'],'landmark'=>['required','string','max:255'],'region'=>['nullable','string','max:100'],'postal'=>['nullable','string','max:20'],'items'=>['required','array','min:1'],'items.*.id'=>['required','integer','exists:products,id'],'items.*.quantity'=>['required','integer','min:1']]);
        $order=$checkout->create($data,$request->user());
        $notifications->adminsForOrder($order, 'New order requires review', $order->customer_name.' placed a new order. Review the items and confirm the delivery fee.');
        return response()->json($this->format($order),201);
    }

    public function update(Request $request, Order $order, EmailNotificationService $notifications): JsonResponse
    {
        $user=$request->user();
        abort_unless($user,401);

        if($user->role==='admin') {
            $data=$request->validate(['payment_status'=>['sometimes','in:awaiting_selection,pending_verification,verified,rejected,cod_pending'],'delivery_status'=>['sometimes','in:pending,packing,handed_over,in_transit,delivered,cancelled'],'workflow_status'=>['sometimes','in:awaiting_admin_review,awaiting_address_confirmation,awaiting_admin_total_confirmation,awaiting_payment,payment_verification,ready_for_fulfillment,completed,cancelled'],'shipping_amount'=>['sometimes','numeric','min:0','max:100000'],'rejection_reason'=>['nullable','string','max:1000'],'archived'=>['sometimes','boolean']]);
            if(array_key_exists('archived',$data)) {
                $order->update(['archived_at'=>$data['archived']?now():null]);
                return response()->json($this->format($order->fresh(['items','user'])));
            }
            if(array_key_exists('shipping_amount',$data)) {
                $data['total_amount']=$order->subtotal-$order->discount_amount+(float)$data['shipping_amount'];
                $data['workflow_status']='awaiting_address_confirmation';
            }
            if(isset($data['delivery_status'])) {
                $data['workflow_status']=match($data['delivery_status']) {
                    'in_transit','handed_over' => 'in_transit',
                    'delivered' => 'completed',
                    'cancelled' => 'cancelled',
                    default => $data['workflow_status'] ?? $order->workflow_status,
                };
            }
            if(($data['delivery_status']??null)==='cancelled'&&$order->delivery_status!=='cancelled') {
                DB::transaction(function() use($order,$data) {
                    $locked=Order::with('items.product')->lockForUpdate()->findOrFail($order->id);
                    foreach($locked->items as $item) {
                        $stock=$item->product?->stocks()->orderBy('expiry_date')->lockForUpdate()->first();
                        if($stock) $stock->increment('quantity',$item->quantity);
                    }
                    $locked->update($data);
                });
            } else $order->update($data);
            $updated=$order->fresh(['items','user']);
            $notifications->customerForOrder($updated, 'Your order has been updated', $this->customerOrderUpdateMessage($updated));
            return response()->json($this->format($updated));
        }

        abort_unless((int)$order->user_id===(int)$user->id,403);
        $request->validate(['delivery_status'=>['required','in:delivered,cancelled']]);

        if($request->string('delivery_status')->toString()==='cancelled') {
            if($order->delivery_status!=='pending') {
                return response()->json(['message'=>'Only pending orders can be cancelled.'],422);
            }

            DB::transaction(function() use($order) {
                $lockedOrder=Order::with('items.product')->lockForUpdate()->findOrFail($order->id);
                abort_unless($lockedOrder->delivery_status==='pending',422,'Only pending orders can be cancelled.');
                foreach($lockedOrder->items as $item) {
                    $stock=$item->product->stocks()->orderBy('expiry_date')->lockForUpdate()->first();
                    if($stock) $stock->increment('quantity',$item->quantity);
                }
                $lockedOrder->update(['delivery_status'=>'cancelled','workflow_status'=>'cancelled']);
                $conversation=Conversation::firstOrCreate(
                    ['user_id'=>$lockedOrder->user_id,'subject'=>'Order support'],
                    ['status'=>'open']
                );
                Message::create([
                    'conversation_id'=>$conversation->id,
                    'sender_id'=>$lockedOrder->user_id,
                    'body'=>'I cancelled order '.$lockedOrder->order_number.'. The order is now cancelled and its reserved products were returned to stock.',
                ]);
            });

            $updated=$order->fresh(['items','user']);
            $notifications->adminsForOrder($updated, 'Customer cancelled an order', $updated->customer_name.' cancelled the pending order. Reserved stock was restored.');
            return response()->json($this->format($updated));
        }

        if(!in_array($order->delivery_status,['handed_over','in_transit'],true)) {
            return response()->json(['message'=>'This order cannot be confirmed as received yet.'],422);
        }

        $updates=['delivery_status'=>'delivered','workflow_status'=>'completed'];
        if($order->payment_status==='cod_pending') $updates['payment_status']='verified';
        $order->update($updates);
        $updated=$order->fresh(['items','user']);
        $notifications->adminsForOrder($updated, 'Customer confirmed delivery', $updated->customer_name.' confirmed that the order was received.');
        return response()->json($this->format($updated));
    }

    public function confirmDelivery(Request $request, Order $order, EmailNotificationService $notifications): JsonResponse
    {
        abort_unless((int)$order->user_id===(int)$request->user()?->id,403);
        abort_unless($order->workflow_status==='awaiting_address_confirmation',422,'The administrator has not confirmed the delivery fee yet.');
        $data=$request->validate(['delivery_fee_payment'=>['required','in:included,pay_on_arrival'],'address'=>['required','string','max:1000'],'landmark'=>['nullable','string','max:255'],'region'=>['nullable','string','max:100'],'postal'=>['nullable','string','max:20']]);
        $total=(float)$order->subtotal-(float)$order->discount_amount+($data['delivery_fee_payment']==='included'?(float)$order->shipping_amount:0);
        $order->update(['delivery_fee_payment'=>$data['delivery_fee_payment'],'shipping_address'=>['address'=>$data['address'],'landmark'=>$data['landmark']??$order->shipping_address['landmark']??null,'region'=>$data['region']??null,'postal'=>$data['postal']??null],'address_confirmed_at'=>now(),'total_amount'=>$total,'workflow_status'=>'awaiting_admin_total_confirmation']);
        $updated=$order->fresh(['items','user']);
        $notifications->adminsForOrder($updated, 'Delivery details confirmed', $updated->customer_name.' confirmed the delivery address and fee option. Review and confirm the final payment total.');
        return response()->json($this->format($updated));
    }

    public function submitPayment(Request $request, Order $order, ImageStorageService $images, EmailNotificationService $notifications): JsonResponse
    {
        abort_unless((int)$order->user_id===(int)$request->user()?->id,403);
        abort_unless($order->workflow_status==='awaiting_payment',422,'Choose how the delivery fee will be paid before proceeding to payment.');
        $data=$request->validate(['payment'=>['required','string','max:80'],'payment_reference'=>['nullable','string','max:120'],'receipt'=>['nullable','image','mimes:jpeg,jpg,png,webp','extensions:jpg,jpeg,png,webp','max:5120','dimensions:max_width=6000,max_height=6000']]);
        $method=PaymentMethod::whereIn('code',['gcash','bank_transfer'])->where('name',$data['payment'])->where('is_active',true)->first();
        if(!$method) return response()->json(['message'=>'The selected payment method is not available.'],422);
        if($method->requires_receipt&&!$request->hasFile('receipt')) return response()->json(['message'=>'Please upload proof of payment.'],422);
        if($method->requires_receipt&&blank($data['payment_reference']??null)) return response()->json(['message'=>'Please enter the receipt reference number.'],422);
        $receipt=$request->hasFile('receipt')?$images->receipt($request->file('receipt')):null;
        $order->update(['payment_method'=>$method->name,'receipt_path'=>$receipt,'payment_reference'=>$data['payment_reference']??null,'payment_status'=>'pending_verification','workflow_status'=>'payment_verification']);
        $updated=$order->fresh(['items','user']);
        $notifications->adminsForOrder($updated, 'Payment receipt submitted', $updated->customer_name.' submitted payment details and a receipt for verification.');
        return response()->json($this->format($updated));
    }

    public function receipt(Request $request, Order $order)
    {
        $user=$request->user();
        abort_unless($user&&($user->role==='admin'||(int)$order->user_id===(int)$user->id),403);
        abort_unless($order->receipt_path&&Storage::disk('local')->exists($order->receipt_path),404);
        $disk=Storage::disk('local');
        $mime=$disk->mimeType($order->receipt_path) ?: 'image/jpeg';
        $response=response()->file($disk->path($order->receipt_path),[
            'Content-Type'=>$mime,
            'Content-Disposition'=>'inline; filename="receipt-'.$order->order_number.'.'.pathinfo($order->receipt_path,PATHINFO_EXTENSION).'"',
        ]);
        $response->setPrivate();
        $response->headers->set('Cache-Control','private, no-store, max-age=0');
        return $response;
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        if($order->delivery_status!=='cancelled'&&!$order->archived_at) {
            return response()->json(['message'=>'Only cancelled or archived orders can be permanently deleted.'],422);
        }

        $receiptPath=$order->receipt_path;
        DB::transaction(function() use($order) {
            $locked=Order::with('items.product')->lockForUpdate()->findOrFail($order->id);
            if(!in_array($locked->delivery_status,['cancelled','delivered'],true)) {
                foreach($locked->items as $item) {
                    $stock=$item->product?->stocks()->orderBy('expiry_date')->lockForUpdate()->first();
                    if($stock) $stock->increment('quantity',$item->quantity);
                }
            }
            $locked->delete();
        });

        if($receiptPath) Storage::disk('local')->delete($receiptPath);
        return response()->json(['ok'=>true]);
    }

    private function format(Order $o): array
    {
        $status=$o->delivery_status==='cancelled'?'cancelled':($o->payment_status==='pending_verification'?'Pending verification':$o->delivery_status);
        $feedback=$o->feedback?->first();
        return ['id'=>$o->id,'userId'=>$o->user_id,'number'=>$o->order_number,'customer'=>$o->customer_name ?: $o->user?->name,'email'=>$o->customer_email,'phone'=>$o->customer_phone,'subtotal'=>(float)$o->subtotal,'discountAmount'=>(float)$o->discount_amount,'shippingAmount'=>(float)$o->shipping_amount,'total'=>(float)$o->total_amount,'payment'=>$o->payment_method,'paymentStatus'=>$o->payment_status,'deliveryStatus'=>$o->delivery_status,'workflowStatus'=>$o->workflow_status,'deliveryFeePayment'=>$o->delivery_fee_payment,'paymentReference'=>$o->payment_reference,'receiptUrl'=>$o->receipt_path?"/api/orders/{$o->id}/receipt":null,'address'=>$o->shipping_address,'status'=>str($o->workflow_status?:$status)->replace('_',' ')->title()->toString(),'date'=>$o->created_at?->format('M j, Y'),'completedAt'=>$o->updated_at?->toIso8601String(),'completedTime'=>$o->updated_at?->format('M j, Y · g:i A'),'isArchived'=>(bool)$o->archived_at,'archivedAt'=>$o->archived_at?->format('M j, Y · g:i A'),'items'=>$o->items?->map(fn($i)=>['name'=>$i->product_name,'quantity'=>$i->quantity,'price'=>(float)$i->unit_price,'lineTotal'=>(float)$i->line_total]),'feedback'=>$feedback?['rating'=>$feedback->rating,'comment'=>$feedback->comment,'submittedAt'=>$feedback->submitted_at?->format('M j, Y')]:null];
    }

    private function customerOrderUpdateMessage(Order $order): string
    {
        return match ($order->workflow_status) {
            'awaiting_address_confirmation' => 'The administrator confirmed the delivery fee. Please verify your delivery address and choose how the fee will be paid.',
            'awaiting_payment' => 'Your final payment total has been confirmed. You may now continue to payment.',
            'payment_verification' => 'Your payment receipt is being reviewed.',
            'ready_for_fulfillment' => 'Your payment was confirmed and your order is ready for fulfillment.',
            'in_transit' => 'Your order is now in transit.',
            'completed' => 'Your order has been marked as delivered and completed.',
            'cancelled' => 'Your order has been cancelled.',
            default => 'There is a new update for your order. Sign in to view the latest details.',
        };
    }
}
