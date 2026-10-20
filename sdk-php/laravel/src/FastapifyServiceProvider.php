<?php

namespace Fastapify\Laravel;

use Fastapify\Laravel\Middleware\FastapifyMiddleware;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

/**
 * FastapifyServiceProvider
 * Automatically registers the fastapify middleware in Laravel applications.
 */
class FastapifyServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap fastapify package services.
     */
    public function boot(): void
    {
        /** @var Router $router */
        $router = $this->app->make(Router::class);
        $router->aliasMiddleware('fastapify', FastapifyMiddleware::class);
    }

    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Bindings if needed
    }
}
