<?php

namespace Tests\Unit;

use App\Services\ImageStorageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageStorageServiceTest extends TestCase
{
    public function test_product_images_are_resized_and_saved_as_optimized_jpegs(): void
    {
        Storage::fake('public');

        $path = app(ImageStorageService::class)->product(
            UploadedFile::fake()->image('large-product.jpg', 2400, 1800),
        );

        Storage::disk('public')->assertExists($path);
        $this->assertStringEndsWith('.jpg', $path);
        [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($path));
        $this->assertLessThanOrEqual(1400, $width);
        $this->assertLessThanOrEqual(1400, $height);
    }

    public function test_receipts_remain_readable_but_are_bounded_jpegs(): void
    {
        Storage::fake('local');

        $path = app(ImageStorageService::class)->receipt(
            UploadedFile::fake()->image('phone-screenshot.png', 1800, 3000),
        );

        Storage::disk('local')->assertExists($path);
        $this->assertStringEndsWith('.jpg', $path);
        [$width, $height] = getimagesizefromstring(Storage::disk('local')->get($path));
        $this->assertLessThanOrEqual(1800, $width);
        $this->assertLessThanOrEqual(2400, $height);
    }

    public function test_qr_codes_are_resized_without_lossy_compression(): void
    {
        Storage::fake('public');

        $path = app(ImageStorageService::class)->qrCode(
            UploadedFile::fake()->image('gcash-qr.jpg', 2000, 2000),
        );

        Storage::disk('public')->assertExists($path);
        $this->assertStringEndsWith('.png', $path);
        [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($path));
        $this->assertSame(1200, $width);
        $this->assertSame(1200, $height);
    }
}
