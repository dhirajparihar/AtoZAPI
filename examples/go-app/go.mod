module example-go-app

go 1.20

require (
	github.com/dhirajparihar/FastAPIfy/sdk-go/gin v0.0.0
	github.com/gin-gonic/gin v1.9.1
)

replace github.com/dhirajparihar/FastAPIfy/sdk-go/gin => ../../sdk-go/gin
