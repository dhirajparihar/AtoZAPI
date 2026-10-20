<?php

namespace Atozapi\Laravel\Tests;

use Atozapi\Laravel\Attributes\Post;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class DummyTestController
{
    #[Post(
        path: '/api/users',
        summary: 'Register User',
        rules: [
            'name' => 'required|string|min:2',
            'age' => 'required|integer|min:18'
        ]
    )]
    public function store(): void {}

    public function untagged(): void {}
}

class AtozapiAttributeTest extends TestCase
{
    public function testPostAttributeInstantiation(): void
    {
        $post = new Post(
            path: '/api/items',
            summary: 'Create item',
            rules: ['title' => 'required|string']
        );

        $this->assertSame('/api/items', $post->getPath());
        $this->assertSame('Create item', $post->getSummary());
        $this->assertSame(['title' => 'required|string'], $post->getRules());
    }

    public function testReflectionExtractsPostAttribute(): void
    {
        $reflection = new ReflectionMethod(DummyTestController::class, 'store');
        $attributes = $reflection->getAttributes(Post::class);

        $this->assertCount(1, $attributes);

        /** @var Post $instance */
        $instance = $attributes[0]->newInstance();

        $this->assertSame('/api/users', $instance->getPath());
        $this->assertSame('Register User', $instance->getSummary());
        $this->assertArrayHasKey('name', $instance->getRules());
        $this->assertArrayHasKey('age', $instance->getRules());
        $this->assertSame('required|string|min:2', $instance->getRules()['name']);
        $this->assertSame('required|integer|min:18', $instance->getRules()['age']);
    }

    public function testUntaggedMethodHasNoPostAttribute(): void
    {
        $reflection = new ReflectionMethod(DummyTestController::class, 'untagged');
        $attributes = $reflection->getAttributes(Post::class);

        $this->assertEmpty($attributes);
    }
}
