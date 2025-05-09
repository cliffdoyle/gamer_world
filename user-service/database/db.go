package database

import (
	"fmt"
	"log"
	"os"

	"github.com/cliffdoyle/gamer_world/user-service/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgres"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "users_db"
	}

	// Use the standard PostgreSQL connection string format for Neon
	// Force sslmode=require for Neon and disable IPv6 by using the hostname directly
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require",
		dbUser,
		dbPassword,
		dbHost,
		dbPort,
		dbName,
	)

	log.Printf("Attempting to connect to database: %s:%s/%s as user %s", dbHost, dbPort, dbName, dbUser)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Enable UUID extension
	DB.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

	// Auto migrate the schema
	err = DB.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatal("Failed to auto-migrate schema:", err)
	}

	log.Println("Connected to database and migrated schema successfully")
}

// RunMigration can be called to explicitly run migrations
func RunMigration() error {
	if DB == nil {
		Connect()
	}

	log.Println("Running migrations...")

	// Enable UUID extension
	DB.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

	// Auto migrate the schema
	err := DB.AutoMigrate(&models.User{})
	if err != nil {
		log.Fatal("Failed to auto-migrate schema:", err)
		return err
	}

	log.Println("Migrations completed successfully")
	return nil
}
