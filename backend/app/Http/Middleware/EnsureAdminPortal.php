<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminPortal
{
    public function handle(Request $request, Closure $next): Response
    {
        $admin = User::find($request->session()->get('admin_user_id'));

        if (! $admin || $admin->role !== 'admin') {
            $request->session()->forget('admin_user_id');

            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Administrator authentication is required.'], 401);
            }

            return redirect()->route('admin.login');
        }

        $request->setUserResolver(fn () => $admin);

        return $next($request);
    }
}
