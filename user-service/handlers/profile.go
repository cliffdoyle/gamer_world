package handlers

import (
	"database/sql"
	"net/http"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/gin-gonic/gin"
)


func GetUserProfile(c *gin.Context){
	username:=c.GetString("username")
	if username==""{
		c.JSON(http.StatusUnauthorized,gin.H{"error":"User not authenticated"})
		return
}
	// Fetch user profile from the database
	user:=models.User{}
	err:=database.DB.QueryRow("SELECT id, username FROM users WHERE username=$1",username).Scan(&user.ID,&user.Username)
	if err!=nil{
		if err==sql.ErrNoRows{
			c.JSON(http.StatusNotFound,gin.H{"error":"User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError,gin.H{"error":"Error fetching user profile"})
		return
}

c.JSON(http.StatusOK,gin.H{
	"user": gin.H{
		"id":       user.ID,
		"username": user.Username,
},
})
}