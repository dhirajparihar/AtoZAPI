package ginfastapify

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// ValidationErrorItem mirrors FastAPI's standard ValidationError schema.
type ValidationErrorItem struct {
	Loc  []string               `json:"loc"`
	Msg  string                 `json:"msg"`
	Type string                 `json:"type"`
	Ctx  map[string]interface{} `json:"ctx,omitempty"`
}

// HTTPValidationError mirrors FastAPI's 422 response payload structure.
type HTTPValidationError struct {
	Detail []ValidationErrorItem `json:"detail"`
}

// ContextKey is the key under which the validated payload is stored in gin.Context.
const ContextKey = "validatedBody"

// getJSONFieldName finds the JSON tag value for a given struct field name.
func getJSONFieldName(structType reflect.Type, structFieldName string) string {
	if structType.Kind() == reflect.Ptr {
		structType = structType.Elem()
	}
	if structType.Kind() != reflect.Struct {
		return strings.ToLower(structFieldName)
	}

	field, found := structType.FieldByName(structFieldName)
	if !found {
		return strings.ToLower(structFieldName)
	}

	jsonTag := field.Tag.Get("json")
	if jsonTag == "" || jsonTag == "-" {
		return strings.ToLower(structFieldName)
	}

	parts := strings.Split(jsonTag, ",")
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}

	return strings.ToLower(structFieldName)
}

// formatValidationError converts Go validation/unmarshaling errors into FastAPI error items.
func formatValidationError(err error, targetType reflect.Type) []ValidationErrorItem {
	var items []ValidationErrorItem

	// 1. Check for validator.ValidationErrors from go-playground/validator
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		for _, fe := range ve {
			jsonFieldName := getJSONFieldName(targetType, fe.Field())
			loc := []string{"body", jsonFieldName}

			var msg string
			var errType string
			var ctx map[string]interface{}

			switch fe.Tag() {
			case "required":
				msg = "Field required"
				errType = "missing"
			case "gte":
				msg = fmt.Sprintf("Input should be greater than or equal to %s", fe.Param())
				errType = "greater_than_equal"
				ctx = map[string]interface{}{"ge": fe.Param()}
			case "lte":
				msg = fmt.Sprintf("Input should be less than or equal to %s", fe.Param())
				errType = "less_than_equal"
				ctx = map[string]interface{}{"le": fe.Param()}
			case "gt":
				msg = fmt.Sprintf("Input should be greater than %s", fe.Param())
				errType = "greater_than"
				ctx = map[string]interface{}{"gt": fe.Param()}
			case "lt":
				msg = fmt.Sprintf("Input should be less than %s", fe.Param())
				errType = "less_than"
				ctx = map[string]interface{}{"lt": fe.Param()}
			case "min":
				msg = fmt.Sprintf("Input should have minimum length or value %s", fe.Param())
				errType = "too_short"
				ctx = map[string]interface{}{"min": fe.Param()}
			case "max":
				msg = fmt.Sprintf("Input should have maximum length or value %s", fe.Param())
				errType = "too_long"
				ctx = map[string]interface{}{"max": fe.Param()}
			case "email":
				msg = "Input should be a valid email address"
				errType = "value_error.email"
			default:
				msg = fmt.Sprintf("Field validation failed on tag '%s'", fe.Tag())
				errType = fmt.Sprintf("validation.%s", fe.Tag())
			}

			items = append(items, ValidationErrorItem{
				Loc:  loc,
				Msg:  msg,
				Type: errType,
				Ctx:  ctx,
			})
		}
		return items
	}

	// 2. Check for JSON UnmarshalTypeError (e.g. string passed when number expected)
	var ute *json.UnmarshalTypeError
	if errors.As(err, &ute) {
		locField := ute.Field
		if locField == "" {
			locField = "unknown"
		}
		items = append(items, ValidationErrorItem{
			Loc:  []string{"body", locField},
			Msg:  fmt.Sprintf("Input should be a valid %s, got %s", ute.Type.String(), ute.Value),
			Type: "type_error",
		})
		return items
	}

	// 3. Check for empty request body
	if errors.Is(err, io.EOF) {
		items = append(items, ValidationErrorItem{
			Loc:  []string{"body"},
			Msg:  "Request body is empty, expected JSON object",
			Type: "missing",
		})
		return items
	}

	// 4. Fallback general error
	items = append(items, ValidationErrorItem{
		Loc:  []string{"body"},
		Msg:  err.Error(),
		Type: "json_decode_error",
	})
	return items
}

// Guard returns a Gin middleware that validates the incoming JSON request
// against the provided schema struct, mimicking FastAPI's validation pipeline.
func Guard(schema interface{}) gin.HandlerFunc {
	// Reflectively extract the underlying struct type
	schemaVal := reflect.ValueOf(schema)
	var targetType reflect.Type

	if schemaVal.Kind() == reflect.Ptr {
		targetType = schemaVal.Type().Elem()
	} else if schemaVal.Kind() == reflect.Struct {
		targetType = schemaVal.Type()
	} else {
		panic(fmt.Sprintf("ginfastapify: Guard expected a struct or struct pointer, received %T", schema))
	}

	return func(c *gin.Context) {
		// Create a fresh instance of the schema struct for this request
		newInstance := reflect.New(targetType).Interface()

		// Intercept and bind incoming JSON request body
		if err := c.ShouldBindJSON(newInstance); err != nil {
			errItems := formatValidationError(err, targetType)

			// Abort immediately with HTTP 422 Unprocessable Entity
			c.AbortWithStatusJSON(http.StatusUnprocessableEntity, HTTPValidationError{
				Detail: errItems,
			})
			return
		}

		// Store verified struct in Gin context for handler retrieval
		c.Set(ContextKey, newInstance)
		c.Next()
	}
}

// GetValidatedBody retrieves the validated struct from the Gin context.
func GetValidatedBody(c *gin.Context) (interface{}, bool) {
	return c.Get(ContextKey)
}

// Body is a generic helper to retrieve and cast the validated struct from the Gin context.
func Body[T any](c *gin.Context) (*T, bool) {
	val, exists := c.Get(ContextKey)
	if !exists {
		return nil, false
	}
	typed, ok := val.(*T)
	return typed, ok
}
