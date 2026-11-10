<?php

namespace App\Http\Controllers;

use App\Models\CustomerFeedback;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CustomerFeedbackController extends Controller
{
    public function index(): JsonResponse
    {
        $feedback=Cache::remember('public.feedback.v1',now()->addMinutes(10),fn()=>CustomerFeedback::query()
                ->where('is_approved', true)
                ->latest('submitted_at')
                ->limit(6)
                ->get()
                ->map(fn (CustomerFeedback $feedback) => [
                    'id' => $feedback->id,
                    'customer' => $feedback->customer_name,
                    'rating' => $feedback->rating,
                    'comment' => $feedback->comment,
                    'date' => $feedback->submitted_at?->format('M Y'),
                ]));
        return response()->json($feedback)->header('Cache-Control','public, max-age=300, stale-while-revalidate=600');
    }

    public function store(Request $request): JsonResponse
    {
        $user=$request->user();
        abort_unless($user?->role==='client',401,'Please sign in as a customer to review an order.');

        $data=$request->validate([
            'order_id'=>['required','integer','exists:orders,id'],
            'rating'=>['required','integer','between:1,5'],
            'comment'=>['required','string','min:5','max:1000'],
        ]);

        $order=Order::query()->whereKey($data['order_id'])->where('user_id',$user->id)->firstOrFail();
        abort_unless($order->delivery_status==='delivered',422,'You can review an order after it has been delivered.');

        $feedback=CustomerFeedback::updateOrCreate(
            ['order_id'=>$order->id],
            [
                'user_id'=>$user->id,
                'customer_name'=>$this->publicCustomerName($user->name),
                'rating'=>$data['rating'],
                'comment'=>trim($data['comment']),
                'is_approved'=>false,
                'submitted_at'=>now(),
            ]
        );

        Cache::forget('public.feedback.v1');

        return response()->json([
            'id'=>$feedback->id,
            'orderId'=>$feedback->order_id,
            'rating'=>$feedback->rating,
            'comment'=>$feedback->comment,
            'submittedAt'=>$feedback->submitted_at?->format('M j, Y'),
        ],$feedback->wasRecentlyCreated?201:200);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);

        return response()->json(CustomerFeedback::query()
            ->with('order:id,order_number')
            ->latest('submitted_at')
            ->get()
            ->map(fn (CustomerFeedback $feedback) => [
                'id'=>$feedback->id,
                'customer'=>$feedback->customer_name,
                'orderNumber'=>$feedback->order?->order_number,
                'rating'=>$feedback->rating,
                'comment'=>$feedback->comment,
                'approved'=>$feedback->is_approved,
                'date'=>$feedback->submitted_at?->format('M j, Y'),
            ]));
    }

    public function moderate(Request $request, CustomerFeedback $feedback): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $data=$request->validate(['approved'=>['required','boolean']]);
        $feedback->update(['is_approved'=>$data['approved']]);
        Cache::forget('public.feedback.v1');

        return response()->json(['id'=>$feedback->id,'approved'=>$feedback->is_approved]);
    }

    private function publicCustomerName(string $name): string
    {
        $parts=preg_split('/\s+/',trim($name)) ?: [];
        if(count($parts)<2) return $parts[0]??'Verified customer';
        return $parts[0].' '.mb_strtoupper(mb_substr(end($parts),0,1)).'.';
    }
}
