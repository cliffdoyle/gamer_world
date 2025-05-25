// tournament-service/internal/handlers/websocket_handler.go
package handlers

import (
	"log"
	"net/http" // For CheckOrigin

	"github.com/cliffdoyle/tournament-service/internal/websocket" // Your hub package
	"github.com/gin-gonic/gin"
	gwebsocket "github.com/gorilla/websocket" // Renamed to avoid conflict with your package
)

var upgrader = gwebsocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Implement proper origin check for production
		// For development, allowing all origins:
		return true
		// Example for production:
		// origin := r.Header.Get("Origin")
		// allowedOrigins := []string{"http://localhost:3000", "https://yourdomain.com"}
		// for _, allowed := range allowedOrigins {
		//  if origin == allowed {
		//      return true
		//  }
		// }
		// return false
	},
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *websocket.Hub, c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		// Don't write HTTP error response here as connection might be hijacked
		return
	}
	log.Printf("WebSocket connection established from: %s", conn.RemoteAddr())

	// Create a new client
	client := &websocket.Client{Conn: conn, Send: make(chan []byte, 256)} // Buffered channel
	hub.Register(client) // Register client with the hub

	// Allow collection of memory referenced by the caller by executing them in new goroutines.
	go client.WritePump()
	go client.ReadPump(hub) // Pass hub to ReadPump for unregistering
}

