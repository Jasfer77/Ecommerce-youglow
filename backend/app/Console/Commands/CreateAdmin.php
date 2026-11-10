<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin {email : Administrator email address} {--name= : Administrator display name}';

    protected $description = 'Create or securely update an administrator account';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $name = trim((string) ($this->option('name') ?: 'You Glow Administrator'));
        $password = (string) $this->secret('Enter a strong administrator password');
        $confirmation = (string) $this->secret('Confirm the administrator password');

        $validator = Validator::make(compact('email', 'name', 'password', 'confirmation'), [
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', Password::min(12)->mixedCase()->numbers()->symbols()],
            'confirmation' => ['same:password'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $existing = User::where('email', $email)->first();
        if ($existing && $existing->role !== 'admin') {
            $this->error('That email already belongs to a customer account.');

            return self::FAILURE;
        }

        User::updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'role' => 'admin', 'password' => Hash::make($password)]
        );

        $this->info('Administrator account is ready.');

        return self::SUCCESS;
    }
}
