package websocket

import (
	"encoding/json"
	"sync"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	// "github.com/cliffdoyle/tournament-service/internal/websocket"
	"log"

	"github.com/gorilla/websocket"
)

// Client represents a single WebSocket connection.
type Client struct {
	Conn *websocket.Conn// The WebSocket connection.
	Send chan []byte // Buffered channel of outbound messages.
	// userID uuid.UUID // Optional: to associate connection with a user
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*Client]bool // Registered clients.
	Broadcast  chan domain.WebSocketMessage // Inbound messages from the services.
	register   chan *Client      // Register requests from the clients.
	unregister chan *Client      // Unregister requests from clients.
	mu         sync.Mutex    // For safe concurrent access to clients map
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan domain.WebSocketMessage),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}


// WritePump pumps messages from the hub to the websocket connection.
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				// The hub closed the channel.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("WebSocket error writing message: %v", err)
				return // Connection will be closed by defer
			}
		}
	}
}

// ReadPump (optional for now if you only broadcast server-to-client)
// It pumps messages from the websocket connection to the hub (if clients send messages).
// For now, we'll just use it to detect closed connections.
func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()
	// You can set read limits if necessary
	// c.conn.SetReadLimit(maxMessageSize)
	// c.conn.SetReadDeadline(time.Now().Add(pongWait))
	// c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, _, err := c.Conn.ReadMessage() // Read messages (even if we don't process them from client)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket unexpected close error: %v", err)
			} else {
				log.Printf("WebSocket client read error (likely closed): %v", err)
			}
			break // Exit loop, triggers defer to unregister and close
		}
		// If you wanted to process client messages, you'd do it here
		// and potentially send them to hub.Broadcast or another channel
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client registered. Total clients: %d", len(h.clients))
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send) // Close the client's send channel
				log.Printf("WebSocket client unregistered. Total clients: %d", len(h.clients))
			}
			h.mu.Unlock()
		case message := <-h.Broadcast: // Message from one of your services
			jsonData, err := json.Marshal(message)
			if err != nil {
				log.Printf("Error marshalling WebSocket message to JSON: %v", err)
				continue
			}
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.Send <- jsonData: // Send to client's buffered channel
				default: // If client's send buffer is full, unregister and close (prevents hub blocking)
					log.Printf("WebSocket client %p send channel full. Closing and unregistering.", client.Conn.RemoteAddr())
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
			log.Printf("Broadcasted WebSocket message: Type=%s", message.Type)
		}
	}
}

// Method for Hub to register a client (exposed for ServeWs)
func (h *Hub) Register(client *Client) {
	h.register <- client
}
