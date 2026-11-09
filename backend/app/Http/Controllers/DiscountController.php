<?php

namespace App\Http\Controllers;

use App\Models\Discount;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DiscountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->admin($request);

        return response()->json(Discount::with(['users:id,name,email'])
            ->latest()->get()->map(fn (Discount $discount) => $this->format($discount)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $this->validated($request);
        $customerIds = $data['customer_ids'];
        unset($data['customer_ids']);
        $data['code'] = strtoupper($data['code']);
        $data['target'] = 'assigned';
        $data['minimum_order_value'] ??= 0;
        $data['usage_limit_per_user'] = 1;
        $data['is_active'] = $data['is_active'] ?? true;

        $discount = Discount::create($data);
        $discount->users()->sync($customerIds);

        return response()->json($this->format($discount->load('users:id,name,email')), 201);
    }

    public function update(Request $request, Discount $discount): JsonResponse
    {
        $this->admin($request);
        $data = $this->validated($request, $discount);
        $customerIds = $data['customer_ids'];
        unset($data['customer_ids']);
        $data['code'] = strtoupper($data['code']);
        $data['target'] = 'assigned';
        $data['minimum_order_value'] ??= 0;
        $data['is_active'] = $data['is_active'] ?? false;

        $discount->update($data);
        $discount->users()->sync($customerIds);

        return response()->json($this->format($discount->load('users:id,name,email')));
    }

    public function destroy(Request $request, Discount $discount): JsonResponse
    {
        $this->admin($request);
        $discount->delete();

        return response()->json(['message' => 'Discount deleted.']);
    }

    private function validated(Request $request, ?Discount $discount = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:40', Rule::unique('discounts', 'code')->ignore($discount?->id)],
            'type' => ['required', Rule::in(['percentage', 'fixed'])],
            'value' => ['required', 'numeric', 'gt:0'],
            'minimum_order_value' => ['nullable', 'numeric', 'min:0'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:today'],
            'is_active' => ['sometimes', 'boolean'],
            'customer_ids' => ['required', 'array', 'min:1'],
            'customer_ids.*' => ['integer', Rule::exists('users', 'id')->where('role', 'client')],
        ]);

        if ($data['type'] === 'percentage' && (float) $data['value'] > 100) {
            throw ValidationException::withMessages(['value' => 'A percentage discount cannot exceed 100%.']);
        }

        return $data;
    }

    private function format(Discount $discount): array
    {
        return [
            'id' => $discount->id,
            'name' => $discount->name,
            'code' => $discount->code,
            'type' => $discount->type,
            'value' => (float) $discount->value,
            'minimumOrderValue' => (float) $discount->minimum_order_value,
            'expiresAt' => $discount->expires_at?->format('Y-m-d'),
            'isActive' => (bool) $discount->is_active,
            'customers' => $discount->users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])->values(),
        ];
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403);
    }
}
