package main

import (
	"log"

	"github.com/cliffdoyle/gamer_world/user-service/database"
)

func main() {
	log.Println("Starting database migration...")

	// This will connect to DB and run the migration
	if err := database.RunMigration(); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully")
}
