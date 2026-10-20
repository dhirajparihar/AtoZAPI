<?php

namespace App\Http\Controllers;

use Atozapi\Laravel\Attributes\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController
{
    #[Post(
        path: '/api/users',
        summary: 'Create user',
        rules: [
            'name' => 'required|string|min:2',
            'age' => 'required|integer|min:18|max:120'
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->attributes->get('validatedBody') ?? $request->only(['name', 'age']);

        return response()->json([
            'id' => rand(10000, 99999),
            'name' => $validated['name'],
            'age' => (int) $validated['age'],
            'createdAt' => date('c'),
        ], 201);
    }
}
