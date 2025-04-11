package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)



func AuthMiddleware()gin.HandlerFunc{
	return func(c *gin.Context){
		authHeader:=c.GetHeader("Authorization")
		if authHeader==""{
			c.JSON(http.StatusUnauthorized,gin.H{
				"error":"Authorization header is missing",
			})
			c.Abort()
			return
		}
		tokenString:=""
		if strings.HasPrefix(authHeader,"Bearer "){
			tokenString=strings.TrimPrefix(authHeader,"Bearer ")
		}else{
			tokenString=authHeader
	}

	//parse and validate the token

}