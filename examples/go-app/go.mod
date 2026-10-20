module example-go-app

go 1.20

require (
	github.com/fastapify/sdk-go/gin v0.0.0
	github.com/gin-gonic/gin v1.9.1
)

replace github.com/fastapify/sdk-go/gin => ../../sdk-go/gin
