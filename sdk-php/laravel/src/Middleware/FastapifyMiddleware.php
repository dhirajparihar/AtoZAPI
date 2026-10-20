<?php

namespace Fastapify\Laravel\Middleware;

use Closure;
use Fastapify\Laravel\Attributes\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use ReflectionMethod;

/**
 * FastapifyMiddleware
 * Inspects route controller methods via PHP 8 Reflection for Fastapify attributes,
 * executes automatic validation, and enforces FastAPI-standard HTTP 422 response formatting.
 */
class FastapifyMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param Request $request
     * @param Closure $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $reflection = $this->resolveRouteReflection($request);

        if (!$reflection) {
            return $next($request);
        }

        // Check for #[Post] attribute on the active controller method
        $attributes = $reflection->getAttributes(Post::class);

        if (empty($attributes)) {
            return $next($request);
        }

        /** @var Post $postAttribute */
        $postAttribute = $attributes[0]->newInstance();
        $rules = $postAttribute->getRules();

        if (empty($rules)) {
            return $next($request);
        }

        // Run validation against request data using the defined rules
        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->buildFastApiErrorResponse($validator);
        }

        // Merge validated safe properties into the request parameter map
        $validatedData = $validator->validated();
        $request->merge($validatedData);
        $request->attributes->set('validatedBody', $validatedData);

        return $next($request);
    }

    /**
     * Resolves the ReflectionMethod for the current routed controller action.
     *
     * @param Request $request
     * @return ReflectionMethod|null
     */
    protected function resolveRouteReflection(Request $request): ?ReflectionMethod
    {
        $route = $request->route();
        if (!$route) {
            return null;
        }

        $controller = null;
        $method = null;

        $action = $route->getAction();

        if (isset($action['controller']) && is_string($action['controller'])) {
            $parts = explode('@', $action['controller']);
            $controller = $parts[0] ?? null;
            $method = $parts[1] ?? null;
        } elseif (isset($action['uses'])) {
            if (is_array($action['uses']) && count($action['uses']) >= 2) {
                $controller = $action['uses'][0];
                $method = $action['uses'][1];
            } elseif (is_string($action['uses']) && str_contains($action['uses'], '@')) {
                $parts = explode('@', $action['uses']);
                $controller = $parts[0] ?? null;
                $method = $parts[1] ?? null;
            }
        }

        // Fallback to route methods if available
        if (!$controller && method_exists($route, 'getController')) {
            $controller = $route->getController();
        }
        if (!$method && method_exists($route, 'getActionMethod')) {
            $method = $route->getActionMethod();
        }

        if ($controller && $method && method_exists($controller, $method)) {
            try {
                return new ReflectionMethod($controller, $method);
            } catch (\ReflectionException $e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Standardizes validation failures into the exact FastAPI HTTP 422 JSON error format.
     *
     * @param \Illuminate\Validation\Validator $validator
     * @return JsonResponse
     */
    protected function buildFastApiErrorResponse(\Illuminate\Validation\Validator $validator): JsonResponse
    {
        $errors = [];
        $failedRules = $validator->failed();
        $errorMessages = $validator->errors()->messages();

        foreach ($errorMessages as $field => $messages) {
            $fieldFailedRules = $failedRules[$field] ?? [];
            $ruleNames = array_keys($fieldFailedRules);

            foreach ($messages as $index => $message) {
                $ruleName = $ruleNames[$index] ?? 'Validation';
                $ruleLower = strtolower($ruleName);

                $errorType = match ($ruleLower) {
                    'required' => 'missing',
                    'numeric', 'integer', 'int' => 'number_type',
                    'string' => 'string_type',
                    'min' => 'too_short',
                    'max' => 'too_long',
                    'email' => 'value_error.email',
                    default => 'value_error.' . $ruleLower,
                };

                $errorItem = [
                    'loc' => ['body', $field],
                    'msg' => $message,
                    'type' => $errorType,
                ];

                // Append limit context if available for min/max
                if (isset($fieldFailedRules[$ruleName])) {
                    $ruleParams = $fieldFailedRules[$ruleName];
                    if (!empty($ruleParams)) {
                        $errorItem['ctx'] = ['limit_value' => $ruleParams[0] ?? null];
                    }
                }

                $errors[] = $errorItem;
            }
        }

        return response()->json([
            'detail' => $errors,
        ], 422);
    }
}
