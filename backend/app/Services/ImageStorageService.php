<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImageStorageService
{
    public function product(UploadedFile $file): string
    {
        return $this->store($file, 'public', 'products', 1400, 1400, 'jpeg', 84);
    }

    public function receipt(UploadedFile $file): string
    {
        return $this->store($file, 'local', 'receipts', 1800, 2400, 'jpeg', 84);
    }

    public function qrCode(UploadedFile $file): string
    {
        return $this->store($file, 'public', 'payment-qr', 1200, 1200, 'png', 8);
    }

    public function messageAttachment(UploadedFile $file): string
    {
        return $this->store($file, 'local', 'message-attachments', 1800, 1800, 'jpeg', 84);
    }

    public function profilePhoto(UploadedFile $file): string
    {
        return $this->store($file, 'public', 'profile-photos', 640, 640, 'jpeg', 84);
    }

    private function store(
        UploadedFile $file,
        string $disk,
        string $directory,
        int $maxWidth,
        int $maxHeight,
        string $format,
        int $quality,
    ): string {
        $contents = file_get_contents($file->getRealPath());
        $source = $contents === false ? false : @imagecreatefromstring($contents);

        if ($source === false) {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be processed.']);
        }

        $source = $this->orient($source, $file);
        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(1, $maxWidth / $width, $maxHeight / $height);
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $target = imagecreatetruecolor($targetWidth, $targetHeight);

        if ($format === 'webp' || $format === 'png') {
            imagealphablending($target, false);
            imagesavealpha($target, true);
            $transparent = imagecolorallocatealpha($target, 255, 255, 255, 127);
            imagefill($target, 0, 0, $transparent);
        } else {
            $white = imagecolorallocate($target, 255, 255, 255);
            imagefill($target, 0, 0, $white);
        }

        imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        ob_start();
        $encoded = match ($format) {
            'webp' => imagewebp($target, null, $quality),
            'png' => imagepng($target, null, $quality),
            default => imagejpeg($target, null, $quality),
        };
        $optimized = ob_get_clean();
        imagedestroy($source);
        imagedestroy($target);

        if (! $encoded || ! is_string($optimized)) {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be optimized.']);
        }

        $extension = $format === 'jpeg' ? 'jpg' : $format;
        $path = $directory.'/'.Str::uuid().'.'.$extension;

        if (! Storage::disk($disk)->put($path, $optimized)) {
            throw ValidationException::withMessages(['image' => 'The optimized image could not be saved.']);
        }

        return $path;
    }

    private function orient(\GdImage $image, UploadedFile $file): \GdImage
    {
        if (! function_exists('exif_read_data') || $file->getMimeType() !== 'image/jpeg') {
            return $image;
        }

        $exif = @exif_read_data($file->getRealPath());
        $orientation = (int) ($exif['Orientation'] ?? 1);

        return match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };
    }
}
