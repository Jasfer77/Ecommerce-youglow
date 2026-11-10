<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Notifications\CustomerPasswordResetNotification;
use App\Services\ImageStorageService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Validation\Rules\File;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', $credentials['email'])->first();
        if (! $user || ! Hash::check($credentials['password'], $user->password)) return response()->json(['message' => 'The email or password is incorrect.'], 422);

        $portal = $request->header('X-YG-Portal') === 'admin' ? 'admin' : 'customer';
        $expectedRole = $portal === 'admin' ? 'admin' : 'client';

        if ($user->role !== $expectedRole) {
            return response()->json([
                'message' => $portal === 'admin'
                    ? 'This account does not have administrator access.'
                    : 'Please use the administrator login for this account.',
            ], 403);
        }

        $request->session()->regenerate();
        $request->session()->put($portal.'_user_id', $user->id);
        return response()->json($this->member($user));
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email', 'max:255', 'unique:users'],
            'phone' => ['required', 'string', 'max:32'], 'password' => ['required', 'string', 'min:8'],
            'marketing' => ['sometimes', 'boolean'],
        ]);
        $user = User::create(['name'=>$data['name'], 'email'=>$data['email'], 'phone'=>$data['phone'], 'password'=>Hash::make($data['password']), 'role'=>'client', 'marketing_consent'=>$data['marketing'] ?? false]);
        $request->session()->regenerate();
        $request->session()->put('customer_user_id', $user->id);
        return response()->json($this->member($user), 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data=$request->validate(['email'=>['required','email','max:255']]);
        $email=strtolower($data['email']);
        $user=User::whereRaw('LOWER(email) = ?',[$email])->where('role','client')->first();

        if($user) {
            $code=(string) random_int(100000,999999);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email'=>$user->email],
                ['token'=>Hash::make($code),'created_at'=>now()]
            );
            $user->notify(new CustomerPasswordResetNotification($code));
        }

        return response()->json([
            'message'=>'If that email belongs to a customer account, a six-digit verification code has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data=$request->validate([
            'code'=>['required','digits:6'],
            'email'=>['required','email','max:255'],
            'password'=>['required','string','min:8','confirmed'],
        ]);

        $email=strtolower($data['email']);
        $customer=User::whereRaw('LOWER(email) = ?',[$email])->where('role','client')->first();
        $reset=$customer ? DB::table('password_reset_tokens')->where('email',$customer->email)->first() : null;
        $expired=!$reset || Carbon::parse($reset->created_at)->lt(now()->subMinutes(10));

        if(!$customer || $expired || !Hash::check($data['code'],$reset->token)) {
            return response()->json(['message'=>'The verification code is invalid or has expired. Request a new code and try again.'],422);
        }

        $customer->forceFill(['password'=>Hash::make($data['password']),'remember_token'=>Str::random(60)])->save();
        DB::table('password_reset_tokens')->where('email',$customer->email)->delete();
        event(new PasswordReset($customer));

        return response()->json(['message'=>'Your password has been changed. You can now sign in.']);
    }

    public function me(Request $request): JsonResponse
    {
        return $request->user() ? response()->json($this->member($request->user())) : response()->json(['message'=>'Unauthenticated'], 401);
    }

    public function update(Request $request, ImageStorageService $images): JsonResponse
    {
        abort_unless($request->user(), 401);
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','unique:users,email,'.$request->user()->id],
            'phone'=>['nullable','string','max:32'],
            'address'=>['nullable','string','max:1000'],
            'landmark'=>['nullable','string','max:255'],
            'profile_photo'=>['nullable',File::image()->types(['jpg','jpeg','png','webp'])->max(5*1024)],
            'remove_profile_photo'=>['sometimes','boolean'],
            'marketing'=>['sometimes','boolean'],
        ]);
        $user=$request->user();
        $oldPhoto=$user->profile_photo_path;
        $newPhoto=$request->hasFile('profile_photo') ? $images->profilePhoto($request->file('profile_photo')) : null;
        $removePhoto=(bool)($data['remove_profile_photo']??false);
        $user->update([
            'name'=>$data['name'],
            'email'=>$data['email'],
            'phone'=>$data['phone'] ?? null,
            'address'=>$data['address'] ?? null,
            'landmark'=>$data['landmark'] ?? null,
            'profile_photo_path'=>$newPhoto ?: ($removePhoto ? null : $oldPhoto),
            'marketing_consent'=>$request->boolean('marketing'),
        ]);
        if($oldPhoto&&($newPhoto||$removePhoto)) {
            Storage::disk('local')->delete($oldPhoto);
            Storage::disk('public')->delete($oldPhoto);
        }
        return response()->json($this->member($request->user()->fresh()));
    }

    public function profilePhoto(Request $request)
    {
        $user=$request->user();
        abort_unless($user,401);
        abort_unless($user->profile_photo_path&&Storage::disk('local')->exists($user->profile_photo_path),404);

        $response=response()->file(Storage::disk('local')->path($user->profile_photo_path),[
            'Content-Type'=>'image/jpeg',
            'Content-Disposition'=>'inline; filename="profile-photo.jpg"',
        ]);
        $response->setPrivate();
        $response->headers->set('Cache-Control','private, no-store, max-age=0');
        return $response;
    }

    public function logout(Request $request): JsonResponse
    {
        $portal = $request->header('X-YG-Portal') === 'admin' ? 'admin' : 'customer';
        $request->session()->forget($portal.'_user_id');
        $request->session()->regenerateToken();
        return response()->json(['ok'=>true]);
    }

    private function member(User $user): array
    {
        $completed=$user->orders()->where('delivery_status','delivered')->count();
        return ['id'=>'C-'.$user->id,'name'=>$user->name,'email'=>$user->email,'phone'=>$user->phone,'address'=>$user->address,'landmark'=>$user->landmark,'profilePhotoUrl'=>$user->profile_photo_path?'/api/auth/profile-photo':null,'role'=>$user->role,'marketing'=>$user->marketing_consent,'completedOrders'=>$completed,'totalSpend'=>(float)$user->orders()->where('delivery_status','delivered')->sum('total_amount'),'segment'=>$user->customerSegment()];
    }
}
