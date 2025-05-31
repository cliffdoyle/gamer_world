'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { WebSocketMessage } from '@/types/websocket'; // Import your types
import { useAuth } from './AuthContext'; // To control connection based on auth state

// Define the WebSocket URL (from environment variable or hardcoded for dev)
// This should point to your Tournament Service's WebSocket endpoint (e.g., ws://localhost:8082/ws)
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8082/ws';

interface WebSocketContextType {
  isConnected: boolean;
  lastJsonMessage: WebSocketMessage | null;
  sendMessage: (message: object) => void; // If you need client-to-server (optional for now)
  // connectWs: () => void; // Exposed for manual connect if needed
  // disconnectWs: () => void; // Exposed for manual disconnect if needed
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastJsonMessage, setLastJsonMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null); // Use a ref to hold the WebSocket instance

  const { isAuthenticated, token } = useAuth(); // Get auth state to manage connection lifecycle

  const connect = useCallback(() => {
    if (!isAuthenticated || (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING))) {
      if(!isAuthenticated) console.log("WebSocket: User not authenticated. Connection not initiated.");
      if(wsRef.current) console.log("WebSocket: Already connected or attempting to connect. State:", wsRef.current.readyState);
      return;
    }

    // If your WebSocket needs the token for auth (e.g., in query param or first message)
    // const connectionUrl = token ? `${WEBSOCKET_URL}?token=${token}` : WEBSOCKET_URL;
    const connectionUrl = WEBSOCKET_URL; // For now, assuming public WS endpoint or auth via other means

    console.log(`WebSocket: Attempting to connect to ${connectionUrl}...`);
    const socket = new WebSocket(connectionUrl);

    socket.onopen = () => {
      console.log('WebSocket: Connection established with', connectionUrl);
      setIsConnected(true);
      wsRef.current = socket; // Store in ref
    };

    socket.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data) as WebSocketMessage;
          console.log('WebSocket: Message received:', data);
          setLastJsonMessage(data); // Update context with the new message
        } else {
          console.warn('WebSocket: Received non-string message data:', event.data);
        }
      } catch (error) {
        console.error('WebSocket: Error parsing received message:', event.data, error);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket: Connection closed. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
      setIsConnected(false);
      wsRef.current = null;
      // Optional: Reconnect logic, but only if authenticated and not a clean close
      // if (isAuthenticated && !event.wasClean) {
      //   setTimeout(() => {
      //     console.log("WebSocket: Attempting to reconnect...");
      //     connect();
      //   }, 5000); // Reconnect after 5 seconds
      // }
    };

    socket.onerror = (error) => {
      console.error('WebSocket: Error occurred:', error);
      setIsConnected(false);
      // wsRef.current might still be the old socket instance before it failed to open
      if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          wsRef.current = null; // Clear ref if connection failed completely
      }
    };
  }, [isAuthenticated, token]); // Add token if you use it in connectionUrl

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log("WebSocket: Manually closing connection.");
      wsRef.current.close(1000, "User disconnected"); // 1000 is normal closure
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Effect to manage connection based on authentication status
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup function when the provider unmounts or isAuthenticated changes
    return () => {
      if (wsRef.current) {
        console.log("WebSocket: Cleaning up connection from useEffect.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, connect, disconnect]);


  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket: Sending message:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket: Not connected or not ready to send message.');
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastJsonMessage, sendMessage /*, connectWs: connect, disconnectWs: disconnect */ }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};