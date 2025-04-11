package handlers

import (
	"database/sql"
	"net/http"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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


func UpdateUserProfile(c *gin.Context){
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
	// Bind the input data
	var input struct{
		NewUsername string `json:"username"`
		NewPassword string `json:"password"`
	}
	if err:=c.ShouldBindJSON(&input);err!=nil{
		c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid input"})
		return	
	}
	// Update the user profile in the database
	if input.NewUsername!=""&&input.NewUsername!=user.Username{
		// Check if the new username already exists
		var count int
		err:=database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username=$1",input.NewUsername).Scan(&count)
		if err!=nil{
			c.JSON(http.StatusInternalServerError,gin.H{"error":"Error checking username"})
			return
		}
		if count>0{
			c.JSON(http.StatusConflict,gin.H{"error":"Username already exists"})
			return
		}
		// Update the username
		_,err=database.DB.Exec("UPDATE users SET username=$1 WHERE id=$2",input.NewUsername,user.ID)
		if err!=nil{
			c.JSON(http.StatusInternalServerError,gin.H{"error":"Error updating username"})
			return
		}
	
	}
	//Update password if provided
	if input.NewPassword!=""{
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
			return
		}
		_, err = database.DB.Exec("UPDATE users SET password=$1 WHERE id=$2", string(hashedPassword), user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating password"})
			return
		}
	}
	// Return the success response

	c.JSON(http.StatusOK, gin.H{"message": "User profile updated successfully",})

}