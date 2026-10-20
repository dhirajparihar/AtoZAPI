package ginfastapify_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	ginfastapify "github.com/dhirajparihar/FastAPIfy/sdk-go/gin"
	"github.com/gin-gonic/gin"
)

type TestUser struct {
	Name string `json:"name" binding:"required"`
	Age  int    `json:"age" binding:"required,gte=18"`
}

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.POST("/api/test-users", ginfastapify.Guard(TestUser{}), func(c *gin.Context) {
		user, ok := ginfastapify.Body[TestUser](c)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve validated body"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"user":    user,
		})
	})

	return r
}

func TestGuardMiddleware_ValidationFailure(t *testing.T) {
	router := setupTestRouter()

	// Missing name and age is below 18
	payload := map[string]interface{}{
		"age": 15,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, "/api/test-users", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Expected status 422 Unprocessable Entity, got %d", w.Code)
	}

	var errResp ginfastapify.HTTPValidationError
	if err := json.Unmarshal(w.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("Failed to parse 422 response JSON: %v", err)
	}

	if len(errResp.Detail) == 0 {
		t.Fatalf("Expected validation error details, got empty array")
	}

	hasMissingName := false
	hasAgeConstraint := false

	for _, item := range errResp.Detail {
		if len(item.Loc) >= 2 && item.Loc[1] == "name" {
			hasMissingName = true
		}
		if len(item.Loc) >= 2 && item.Loc[1] == "age" {
			hasAgeConstraint = true
		}
	}

	if !hasMissingName {
		t.Errorf("Expected validation error for missing field 'name'")
	}
	if !hasAgeConstraint {
		t.Errorf("Expected validation error for age constraint 'gte=18'")
	}
}

func TestGuardMiddleware_Success(t *testing.T) {
	router := setupTestRouter()

	payload := map[string]interface{}{
		"name": "Alice Smith",
		"age":  25,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, "/api/test-users", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	if res["success"] != true {
		t.Errorf("Expected success to be true, got %v", res["success"])
	}
}

func TestGuardMiddleware_EmptyBody(t *testing.T) {
	router := setupTestRouter()

	req, _ := http.NewRequest(http.MethodPost, "/api/test-users", bytes.NewBuffer([]byte("")))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Expected status 422 for empty body, got %d", w.Code)
	}
}
