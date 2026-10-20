<?php

namespace Atozapi\Laravel;

use Atozapi\Laravel\Middleware\AtozapiMiddleware;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

/**
 * AtozapiServiceProvider
 * Automatically registers the atozapi middleware in Laravel applications.
 */
class AtozapiServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap atozapi package services.
     */
    public function boot(): void
    {
        /** @var Router $router */
        $router = $this->app->make(Router::class);
        $router->aliasMiddleware('atozapi', AtozapiMiddleware::class);
    }

    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Bindings if needed
    }
}
