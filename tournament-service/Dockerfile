# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

# Copy and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o tournament-service ./cmd/main.go

# Final stage
FROM alpine:latest

# Install necessary runtime dependencies
RUN apk --no-cache add ca-certificates postgresql-client

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/tournament-service .

# Copy environment file
COPY .env .

# Copy migrations
COPY migrations /migrations/

# Copy migration script and make it executable
COPY run-migrations.sh /run-migrations.sh
RUN chmod +x /run-migrations.sh

# Copy and make the wait-for-postgres script executable
COPY wait-for-postgres.sh /wait-for-postgres.sh
RUN chmod +x /wait-for-postgres.sh

# Command to run
CMD ["./tournament-service"] 