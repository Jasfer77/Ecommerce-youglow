<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json(User::where('role', 'admin')->orderBy('name')->get()->map(fn (User $admin) => [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'phone' => $admin->phone,
            'createdAt' => $admin->created_at?->format('M j, Y'),
            'isCurrent' => $admin->id === $request->user()->id,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $admin = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'role' => 'admin',
        ]);

        return response()->json(['id' => $admin->id, 'name' => $admin->name, 'message' => 'Administrator created.'], 201);
    }

    public function update(Request $request, User $admin): JsonResponse
    {
        $this->authorizeAdmin($request);
        abort_unless($admin->role === 'admin', 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);
        $changes = ['name'=>$data['name'],'email'=>strtolower($data['email']),'phone'=>$data['phone']??null];
        if (! empty($data['password'])) $changes['password'] = Hash::make($data['password']);
        $admin->update($changes);
        return response()->json(['id'=>$admin->id,'name'=>$admin->name,'message'=>'Administrator updated.']);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403);
    }
}
