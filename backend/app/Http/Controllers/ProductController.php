<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Services\ImageStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $isAdmin=$request->user()?->role==='admin';
        $load=function() use($isAdmin) {
            $query=Product::with(['category','stocks'=>fn($q)=>$q->orderBy('expiry_date')]);
            if(!$isAdmin) $query->where('is_active',true);
            return $query->orderBy('id')->get()->map(fn(Product $product)=>$this->format($product, $isAdmin));
        };
        $products=$isAdmin?$load():Cache::remember('public.products.v1',now()->addMinutes(5),$load);
        return response()->json($products)->header('Cache-Control',$isAdmin?'private, no-store':'public, max-age=60, stale-while-revalidate=300');
    }

    public function store(Request $request): JsonResponse
    {
        $this->admin($request);
        $product=DB::transaction(fn()=> $this->persist(new Product,$this->validated($request),$request,app(ImageStorageService::class)));
        Cache::forget('public.products.v1');
        return response()->json($this->format($product),201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->admin($request);
        $product=DB::transaction(fn()=> $this->persist($product,$this->validated($request,$product),$request,app(ImageStorageService::class)));
        Cache::forget('public.products.v1');
        return response()->json($this->format($product));
    }

    public function visibility(Request $request, Product $product): JsonResponse
    {
        $this->admin($request);
        $data=$request->validate(['isActive'=>['required','boolean']]);
        $product->update(['is_active'=>$data['isActive']]);
        Cache::forget('public.products.v1');
        return response()->json($this->format($product->load(['category','stocks'])));
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->admin($request);
        if($product->orderItems()->exists()) return response()->json(['message'=>'This product has sales history. Hide it instead of deleting it.'],409);
        foreach($product->images??[] as $image) Storage::disk('public')->delete($image);
        $product->delete();
        Cache::forget('public.products.v1');
        return response()->json(['ok'=>true]);
    }

    private function persist(Product $product,array $data,Request $request,ImageStorageService $imagesService): Product
    {
        $category=Category::firstOrCreate(['slug'=>Str::slug($data['category'])],['name'=>$data['category']]);
        $slug=Str::slug($data['name']);
        if(Product::where('slug',$slug)->when($product->exists,fn($q)=>$q->where('id','!=',$product->id))->exists()) $slug.='-'.Str::lower(Str::random(4));
        $images=$product->images??[];
        if($request->boolean('remove_image')||$request->hasFile('image')) { foreach($images as $image) Storage::disk('public')->delete($image); $images=[]; }
        if($request->hasFile('image')) $images=[$imagesService->product($request->file('image'))];
        $product->fill(['category_id'=>$category->id,'sku'=>$data['sku'],'name'=>$data['name'],'slug'=>$slug,'description'=>$data['benefit'],'price'=>$data['price'],'weight_kg'=>$data['weight_kg']??0,'images'=>$images,'attributes'=>['short'=>$data['short'],'tone'=>$data['tone']??$product->attributes['tone']??'peach'],'is_active'=>$data['isActive']])->save();
        $product->stocks()->where('batch_number','!=',$data['batch'])->delete();
        $product->stocks()->updateOrCreate(['batch_number'=>$data['batch']],['quantity'=>$data['stock'],'expiry_date'=>$data['expiry']]);
        return $product->fresh(['category','stocks'=>fn($q)=>$q->orderBy('expiry_date')]);
    }

    private function validated(Request $request,?Product $product=null): array
    {
        $data=$request->validate(['name'=>['required','string','max:160'],'category'=>['nullable','string','max:100'],'sku'=>['nullable','string','max:80',Rule::unique('products','sku')->ignore($product?->id)],'price'=>['required','numeric','min:0'],'weight_kg'=>['nullable','numeric','min:0'],'stock'=>['required','integer','min:0'],'batch'=>['nullable','string','max:80'],'expiry'=>['nullable','date'],'benefit'=>['required','string','max:500'],'tone'=>['nullable','in:peach,sage,rose,lilac,sand,honey'],'isActive'=>['nullable','boolean'],'image'=>['nullable','image','mimes:jpeg,jpg,png,webp','extensions:jpg,jpeg,png,webp','max:5120','dimensions:max_width=6000,max_height=6000'],'remove_image'=>['nullable','boolean']]);
        $generatedShort=Str::upper(Str::substr(preg_replace('/[^A-Za-z0-9]/','',$data['name']),0,10)) ?: 'PRODUCT';
        $data['short']=$product?->attributes['short']??$generatedShort;
        $data['category']=trim($data['category']??'') ?: ($product?->category?->name??'Uncategorized');
        $data['price']=$data['price']??(float)($product?->price??0);
        $data['batch']=Str::upper(trim($data['batch']??'')) ?: ($product?->stocks()->value('batch_number')??'DEFAULT-'.Str::upper(Str::random(6)));
        $data['expiry']=$data['expiry']??$product?->stocks()->value('expiry_date');
        $data['isActive']=$data['isActive']??($product?->is_active??true);
        $data['sku']=($data['sku']??null)?:Str::upper(Str::slug($data['short'])).'-'.Str::upper(Str::random(6));
        return $data;
    }

    private function format(Product $product, bool $includeInventory = true): array
    {
        $product->loadMissing(['category','stocks'=>fn($q)=>$q->orderBy('expiry_date')]); $stock=$product->stocks->first();
        $image=$product->images[0]??null;
        $payload=['id'=>(string)$product->id,'name'=>$product->name,'short'=>$product->attributes['short']??$product->sku,'category'=>$product->category->name,'price'=>(float)$product->price,'tone'=>$product->attributes['tone']??'peach','benefit'=>$product->description,'imageUrl'=>$image?Storage::disk('public')->url($image):null,'inStock'=>$product->stocks->sum('quantity')>0];
        if($includeInventory) $payload+=['sku'=>$product->sku,'weight_kg'=>(float)$product->weight_kg,'stock'=>(int)$product->stocks->sum('quantity'),'batch'=>$stock?->batch_number??'—','expiry'=>$stock?->expiry_date?->format('Y-m-d'),'isActive'=>$product->is_active];
        return $payload;
    }

    private function admin(Request $request): void { abort_unless($request->user()?->role==='admin',403,'Admin access required.'); }
}
