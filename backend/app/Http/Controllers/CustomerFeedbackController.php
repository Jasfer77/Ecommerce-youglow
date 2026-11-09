<?php

namespace App\Http\Controllers;

use App\Models\CustomerFeedback;
use Illuminate\Http\JsonResponse;
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
}
