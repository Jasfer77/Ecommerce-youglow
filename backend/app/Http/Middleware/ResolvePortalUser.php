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

        // Native media requests made by <img> cannot include our custom portal
        // header. Allow an explicit portal hint only for read-only requests so
        // private images can still resolve the correct isolated session.
        if (! $portal && $request->isMethod('GET')) {
            $portal = $request->query('portal');
        }

        if (in_array($portal, ['admin', 'customer'], true)) {
            $sessionKey = $portal === 'admin' ? 'admin_user_id' : 'customer_user_id';
            $sessionUserId = $request->session()->get($sessionKey);
            if ($sessionUserId) {
                $request->setUserResolver(fn () => User::find($sessionUserId));
            }
        }

        return $next($request);
    }
}
