# Google OAuth Setup Guide for Gamer World

This guide explains how to properly set up Google OAuth authentication for the Gamer World application.

## Common Errors

If you're seeing an error like this:
```
Invalid Google ID token: idtoken: audience provided does not match aud claim in the JWT
```

This means that the Google Client ID being used to validate tokens doesn't match the one used to create them. This is typically caused by configuration issues.

## Setting Up Google OAuth

### 1. Create OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Set up an application type as "Web application"
6. Add authorized JavaScript origins:
   - For local development: `http://localhost:3000`
   - For production: `https://your-production-domain.com`
7. Add authorized redirect URIs:
   - For local development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-production-domain.com/api/auth/callback/google`
8. Copy your Client ID - you'll need it for both frontend and backend

### 2. Configure Environment Variables

**Frontend Environment Variables:**

Create or update `.env.local` in the `tournament-frontend` directory:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
NEXT_PUBLIC_USER_SERVICE_URL=http://localhost:8081
```

**Backend Environment Variables:**

For local development, set environment variables before starting the server:

```bash
export GOOGLE_CLIENT_ID=your-client-id-here
export JWT_SECRET=your-jwt-secret-here
```

For production, set these environment variables in your deployment environment.

### 3. Verify Configuration

To check your backend Google OAuth configuration, run:

```bash
cd user-service
go run scripts/check-google-config.go
```

### 4. Important Notes

- Use the **same** Google Client ID for both frontend and backend
- Don't use a test client ID in production
- If you change your domain or port, update the authorized origins in Google Cloud Console
- Keep your client ID and JWT secret secure

### 5. Troubleshooting

- **Invalid audience error**: Ensure the same client ID is used in both frontend and backend
- **Token validation fails**: Check that your client ID is correctly set as an environment variable  
- **Redirect errors**: Verify your authorized redirect URIs in Google Cloud Console

For more help, see the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2) 