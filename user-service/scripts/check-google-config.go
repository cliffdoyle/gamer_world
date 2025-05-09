package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("=== Google OAuth Configuration Checker ===")
	fmt.Println()

	// Check if GOOGLE_CLIENT_ID is set
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		fmt.Println("❌ GOOGLE_CLIENT_ID environment variable is not set")
		fmt.Println("   This is required for Google authentication to work properly.")
		fmt.Println("   You can set it using: export GOOGLE_CLIENT_ID='your-client-id'")
	} else {
		fmt.Println("✅ GOOGLE_CLIENT_ID is set to: " + clientID[:12] + "..." + clientID[len(clientID)-8:])
	}

	fmt.Println()
	fmt.Println("Common issues with Google OAuth:")
	fmt.Println("1. Using different client IDs for frontend and backend")
	fmt.Println("2. Using a development client ID in production or vice versa")
	fmt.Println("3. Not adding the correct JavaScript origins or redirect URIs in Google Cloud Console")
	fmt.Println()
	fmt.Println("To fix:")
	fmt.Println("- Verify that you're using the correct client ID from Google Cloud Console")
	fmt.Println("- Check that your authorized origins include your frontend domain")
	fmt.Println("- Make sure your redirect URIs are correctly configured")
	fmt.Println()
	fmt.Println("For local development, your JavaScript origins should include:")
	fmt.Println("- http://localhost:3000")
	fmt.Println("- http://localhost:8081 (if testing directly with the backend)")
}
