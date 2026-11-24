<?php

namespace App\Http\Controllers;

use App\Models\CustomerFeedback;
use App\Models\Order;
use App\Services\ImageStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class CustomerFeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $viewAll=$request->boolean('all');
        $feedback=Cache::remember($viewAll?'public.feedback.all.v1':'public.feedback.v1',now()->addMinutes(10),fn()=>CustomerFeedback::query()
                ->where('is_approved', true)
                ->latest('submitted_at')
                ->limit($viewAll?100:6)
                ->get()
                ->map(fn (CustomerFeedback $feedback) => [
                    'id' => $feedback->id,
                    'customer' => $feedback->customer_name,
                    'rating' => $feedback->rating,
                    'comment' => $feedback->comment,
                    'photos' => $this->photoUrls($feedback),
                    'date' => $feedback->submitted_at?->format('M Y'),
                ]));
        return response()->json($feedback)->header('Cache-Control','public, max-age=300, stale-while-revalidate=600');
    }

    public function store(Request $request, ImageStorageService $images): JsonResponse
    {
        $user=$request->user();
        abort_unless($user?->role==='client',401,'Please sign in as a customer to review an order.');

        $data=$request->validate([
            'order_id'=>['required','integer','exists:orders,id'],
            'rating'=>['required','integer','between:1,5'],
            'comment'=>['required','string','min:5','max:1000'],
            'photos'=>['nullable','array','max:3'],
            'photos.*'=>['image','mimes:jpeg,jpg,png,webp','extensions:jpg,jpeg,png,webp','max:5120','dimensions:max_width=6000,max_height=6000'],
        ]);

        $order=Order::query()->whereKey($data['order_id'])->where('user_id',$user->id)->firstOrFail();
        abort_unless($order->delivery_status==='delivered',422,'You can review an order after it has been delivered.');

        $existing=CustomerFeedback::where('order_id',$order->id)->first();
        $photoPaths=$existing?->photo_paths??[];
        if($request->hasFile('photos')) {
            $newPaths=[];
            try {
                foreach($request->file('photos') as $photo) $newPaths[]=$images->feedbackPhoto($photo);
            } catch (\Throwable $exception) {
                foreach($newPaths as $path) Storage::disk('local')->delete($path);
                throw $exception;
            }
            foreach($photoPaths as $path) Storage::disk('local')->delete($path);
            $photoPaths=$newPaths;
        }

        $feedback=CustomerFeedback::updateOrCreate(
            ['order_id'=>$order->id],
            [
                'user_id'=>$user->id,
                'customer_name'=>$this->publicCustomerName($user->name),
                'rating'=>$data['rating'],
                'comment'=>trim($data['comment']),
                'photo_paths'=>$photoPaths,
                'is_approved'=>false,
                'submitted_at'=>now(),
            ]
        );

        Cache::forget('public.feedback.v1');
        Cache::forget('public.feedback.all.v1');

        return response()->json([
            'id'=>$feedback->id,
            'orderId'=>$feedback->order_id,
            'rating'=>$feedback->rating,
            'comment'=>$feedback->comment,
            'photos'=>$this->photoUrls($feedback),
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
                'photos'=>$this->photoUrls($feedback),
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
        Cache::forget('public.feedback.all.v1');

        return response()->json(['id'=>$feedback->id,'approved'=>$feedback->is_approved]);
    }

    public function photo(Request $request, CustomerFeedback $feedback, int $index)
    {
        $user=$request->user();
        abort_unless($feedback->is_approved||($user&&($user->role==='admin'||(int)$feedback->user_id===(int)$user->id)),403);
        $path=($feedback->photo_paths??[])[$index]??null;
        abort_unless($path&&Storage::disk('local')->exists($path),404);
        $response=Storage::disk('local')->response($path,"review-photo-{$feedback->id}-".($index+1).'.jpg',[
            'Content-Type'=>'image/jpeg',
        ]);
        if($feedback->is_approved) $response->setPublic();
        else $response->setPrivate();
        $response->headers->set('Cache-Control',$feedback->is_approved?'public, max-age=86400':'private, no-store, max-age=0');
        return $response;
    }

    private function photoUrls(CustomerFeedback $feedback): array
    {
        return collect($feedback->photo_paths??[])
            ->keys()
            ->map(fn (int $index) => route('feedback.photo',['feedback'=>$feedback,'index'=>$index],absolute:false))
            ->values()
            ->all();
    }

    private function publicCustomerName(string $name): string
    {
        $parts=preg_split('/\s+/',trim($name)) ?: [];
        if(count($parts)<2) return $parts[0]??'Verified customer';
        return $parts[0].' '.mb_strtoupper(mb_substr(end($parts),0,1)).'.';
    }
}
