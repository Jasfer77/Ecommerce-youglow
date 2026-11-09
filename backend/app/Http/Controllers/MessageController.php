<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\EmailNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class MessageController extends Controller
{
    public function clients(Request $request): JsonResponse
    {
        $this->admin($request);
        $clients=User::where('role','client')
            ->withCount(['orders as completed_orders'=>fn($q)=>$q->where('delivery_status','delivered')])
            ->withSum(['orders as total_spend'=>fn($q)=>$q->where('delivery_status','delivered')],'total_amount')
            ->addSelect(['unread_messages'=>Message::query()
                ->selectRaw('count(*)')
                ->join('conversations','conversations.id','=','messages.conversation_id')
                ->whereColumn('conversations.user_id','users.id')
                ->whereColumn('messages.sender_id','users.id')
                ->whereNull('messages.read_at')])
            ->orderBy('name')->get();

        return response()->json($clients->map(function($user) {
            $segment=$user->customerSegment();
            return ['id'=>'C-'.$user->id,'userId'=>$user->id,'name'=>$user->name,'email'=>$user->email,'phone'=>$user->phone,'completedOrders'=>$user->completed_orders,'totalSpend'=>(float)($user->total_spend??0),'unreadMessages'=>(int)$user->unread_messages,'segment'=>str($segment)->replace('_client','')->title()->toString(),'offer'=>$segment==='new_client'?'NEW10':($segment==='old_client'?'LOYAL12':'GLOW250')];
        }));
    }

    public function storeClient(Request $request): JsonResponse
    {
        $this->admin($request);
        $data=$request->validate(['name'=>['required','string','max:120'],'email'=>['required','email','max:255','unique:users,email'],'phone'=>['required','string','max:32'],'address'=>['nullable','string','max:1000'],'password'=>['required','string','min:8','confirmed'],'marketing_consent'=>['sometimes','boolean']]);
        $user=User::create(['name'=>$data['name'],'email'=>strtolower($data['email']),'phone'=>$data['phone'],'address'=>$data['address']??null,'password'=>Hash::make($data['password']),'role'=>'client','marketing_consent'=>$data['marketing_consent']??false]);
        return response()->json(['userId'=>$user->id,'name'=>$user->name,'message'=>'Customer created.'],201);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user(),401);
        $userId=$request->user()->role==='admin' ? (int)$request->query('user_id') : $request->user()->id;
        abort_unless($userId,422,'A customer is required.');
        $conversation=Conversation::firstOrCreate(['user_id'=>$userId,'subject'=>'Order support'],['status'=>'open']);
        if($request->user()->role==='admin') $conversation->messages()->where('sender_id',$userId)->whereNull('read_at')->update(['read_at'=>now()]);
        else $conversation->messages()->whereHas('sender',fn($q)=>$q->where('role','admin'))->whereNull('read_at')->update(['read_at'=>now()]);
        return response()->json($conversation->messages()->with('sender')->oldest()->get()->map(fn($m)=>['id'=>$m->id,'from'=>$m->sender->role==='admin'?'support':'customer','text'=>$m->body,'time'=>$m->created_at->format('M j, Y · g:i A'),'timestamp'=>$m->created_at->toIso8601String()]));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        abort_unless($request->user(),401);
        if($request->user()->role==='admin') return response()->json(['count'=>0]);
        $count=Message::whereHas('conversation',fn($q)=>$q->where('user_id',$request->user()->id))->whereHas('sender',fn($q)=>$q->where('role','admin'))->whereNull('read_at')->count();
        return response()->json(['count'=>$count]);
    }

    public function store(Request $request, EmailNotificationService $notifications): JsonResponse
    {
        abort_unless($request->user(),401); $data=$request->validate(['text'=>['required','string','max:2000'],'user_id'=>['nullable','integer','exists:users,id']]);
        $userId=$request->user()->role==='admin' ? ($data['user_id']??null) : $request->user()->id; abort_unless($userId,422,'A customer is required.');
        $conversation=Conversation::firstOrCreate(['user_id'=>$userId,'subject'=>'Order support'],['status'=>'open']);
        $message=Message::create(['conversation_id'=>$conversation->id,'sender_id'=>$request->user()->id,'body'=>$data['text']]);
        $customer=User::whereKey($userId)->where('role','client')->firstOrFail();
        if($request->user()->role==='admin') $notifications->customerForMessage($customer,$request->user(),$message->body);
        else $notifications->adminsForMessage($customer,$message->body);
        return response()->json(['id'=>$message->id,'from'=>$request->user()->role==='admin'?'support':'customer','text'=>$message->body,'time'=>$message->created_at->format('M j, Y · g:i A'),'timestamp'=>$message->created_at->toIso8601String()],201);
    }

    private function admin(Request $request): void { abort_unless($request->user()?->role==='admin',403); }
}
