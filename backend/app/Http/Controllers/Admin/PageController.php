<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PageController extends Controller
{
    public function dashboard(): BinaryFileResponse
    {
        return response()->file(resource_path('admin/dashboard.html'));
    }

    public function login(): BinaryFileResponse
    {
        return response()->file(resource_path('admin/login.html'));
    }
}
