<?php

namespace App\Http\Controllers;

use App\Models\PaymentMethod;
use App\Services\ImageStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;

class PaymentMethodController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $isAdmin=$request->user()?->role==='admin';
        $load=function() use($isAdmin) {$query=PaymentMethod::orderBy('sort_order');if(!$isAdmin)$query->where('is_active',true);return $query->get()->map(fn($method)=>$this->format($method));};
        $methods=$isAdmin?$load():Cache::remember('public.payment-methods.v1',now()->addMinutes(5),$load);
        return response()->json($methods)->header('Cache-Control',$isAdmin?'private, no-store':'public, max-age=60, stale-while-revalidate=300');
    }

    public function update(Request $request, PaymentMethod $paymentMethod, ImageStorageService $images): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $data=$request->validate(['name'=>['required','string','max:80'],'account_name'=>['nullable','string','max:255'],'account_number'=>['nullable','string','max:100'],'bank_name'=>['nullable','string','max:255'],'instructions'=>['nullable','string','max:1000'],'is_active'=>['required','boolean'],'requires_receipt'=>['required','boolean'],'qr'=>['nullable','image','mimes:jpeg,jpg,png,webp','extensions:jpg,jpeg,png,webp','max:5120','dimensions:max_width=6000,max_height=6000'],'remove_qr'=>['nullable','boolean']]);
        if ($request->boolean('remove_qr') && $paymentMethod->qr_path) { Storage::disk('public')->delete($paymentMethod->qr_path); $data['qr_path']=null; }
        if ($request->hasFile('qr')) { if($paymentMethod->qr_path) Storage::disk('public')->delete($paymentMethod->qr_path); $data['qr_path']=$images->qrCode($request->file('qr')); }
        unset($data['qr'],$data['remove_qr']);
        $paymentMethod->update($data);
        Cache::forget('public.payment-methods.v1');
        return response()->json($this->format($paymentMethod->fresh()));
    }

    private function format(PaymentMethod $method): array
    {
        return ['id'=>$method->id,'code'=>$method->code,'name'=>$method->name,'accountName'=>$method->account_name,'accountNumber'=>$method->account_number,'bankName'=>$method->bank_name,'instructions'=>$method->instructions,'qrUrl'=>$method->qr_path?Storage::disk('public')->url($method->qr_path):null,'isActive'=>$method->is_active,'requiresReceipt'=>$method->requires_receipt];
    }
}
