package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	ginatozapi "github.com/dhirajparihar/AtoZAPI/sdk-go/gin"
	"github.com/gin-gonic/gin"
)

// User defines the registration schema with binding constraints.
type User struct {
	Name string `json:"name" binding:"required"`
	Age  int    `json:"age" binding:"required,gte=18"`
}

func main() {
	// Initialize default Gin engine with logging and recovery
	r := gin.Default()

	// Root health check & info route
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Welcome to AtoZAPI Go (Gin) API",
			"endpoints": gin.H{
				"createUser": "POST /api/users",
			},
			"framework": "Gin",
		})
	})

	// POST /api/users protected by ginatozapi.Guard middleware
	r.POST("/api/users", ginatozapi.Guard(User{}), func(c *gin.Context) {
		user, ok := ginatozapi.Body[User](c)
		if !ok {
			raw, _ := ginatozapi.GetValidatedBody(c)
			user = raw.(*User)
		}

		c.JSON(http.StatusCreated, gin.H{
			"id":        time.Now().UnixNano() % 100000,
			"name":      user.Name,
			"age":       user.Age,
			"createdAt": time.Now().UTC().Format(time.RFC3339),
		})
	})

	port := ":8080"
	log.Printf("[go-app] Listening on http://localhost%s", port)
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to run Gin server: %v", err)
	}
}
