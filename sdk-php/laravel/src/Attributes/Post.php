<?php

namespace Atozapi\Laravel\Attributes;

use Attribute;

/**
 * Native PHP 8 Attribute marking a controller method as an AtoZAPI POST route.
 * Provides metadata for automatic request validation and OpenAPI documentation.
 */
#[Attribute(Attribute::TARGET_METHOD)]
class Post
{
    /**
     * @param string $path URL route path (e.g. '/api/users')
     * @param string $summary Brief summary for OpenAPI generation
     * @param array $rules Laravel validation rules (e.g. ['name' => 'required|string', 'age' => 'required|integer|min:18'])
     */
    public function __construct(
        public string $path = '',
        public string $summary = '',
        public array $rules = []
    ) {}

    public function getPath(): string
    {
        return $this->path;
    }

    public function getSummary(): string
    {
        return $this->summary;
    }

    public function getRules(): array
    {
        return $this->rules;
    }
}
