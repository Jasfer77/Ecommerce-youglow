<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolvePortalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $portal = $request->header('X-YG-Portal');

        if (in_array($portal, ['admin', 'customer'], true)) {
            $sessionKey = $portal === 'admin' ? 'admin_user_id' : 'customer_user_id';
            $request->setUserResolver(fn () => User::find($request->session()->get($sessionKey)));
        }

        return $next($request);
    }
}
