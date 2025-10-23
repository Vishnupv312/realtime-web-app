# 🔐 Guest Authentication Integration Guide

## Current Issue
The frontend Socket.IO connection is failing because:
1. Socket connects with `token: None` (no JWT token available for guests)
2. Backend requires valid JWT token for all socket connections
3. Missing guest session creation flow

## ✅ Complete Solution

### 1. Backend Status: ✅ READY
- JWT token generation: `/api/auth/guest/username` ✅
- Guest session creation: `/api/auth/guest` ✅ 
- Socket.IO authentication: Supports guest tokens ✅
- In-memory session store: Tracks all guest data ✅

### 2. Frontend Integration Steps

#### Step 1: Update Guest Session Context
The frontend needs to integrate JWT token handling into the guest session flow.

**File:** `/web/contexts/GuestSessionContext.tsx`

Add this function to create guest session with JWT:

```typescript
const createGuestSessionWithAuth = async (username: string): Promise<string> => {
  try {
    const response = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      throw new Error('Failed to create guest session');
    }

    const data = await response.json();
    
    if (data.success) {
      // Store JWT token in sessionStorage
      sessionStorage.setItem('guestAuthToken', data.data.token);
      return data.data.token;
    } else {
      throw new Error(data.message || 'Session creation failed');
    }
  } catch (error) {
    console.error('Guest session creation failed:', error);
    throw error;
  }
};
```

#### Step 2: Update Socket Connection
**File:** `/web/lib/socket.ts`

Update the connect method to use guest JWT tokens:

```typescript
connect(guestUser?: GuestUser): Socket {
  // Try to get token from different sources
  const regularToken = Cookies.get("authToken") || localStorage.getItem("authToken");
  const guestToken = sessionStorage.getItem("guestAuthToken");
  
  const token = regularToken || guestToken;

  if (!token && !guestUser) {
    console.error("❌ No authentication token or guest user found");
    throw new Error("No authentication token or guest user found");
  }

  console.log("🔌 Attempting to connect to:", SOCKET_URL);
  console.log("🔑 Using auth token:", token ? `${token.substring(0, 10)}...` : "None");
  console.log("👤 Guest user:", guestUser ? guestUser.username : "None");

  // Store current user for presence management
  this.currentUser = guestUser || null;

  // Disconnect existing socket if any
  if (this.socket) {
    this.socket.disconnect();
  }

  this.socket = io(SOCKET_URL, {
    auth: {
      token: token, // Use JWT token for authentication
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: true
  });

  this.setupEventListeners();
  return this.socket;
}
```

#### Step 3: Update Guest Username Modal
**File:** `/web/components/GuestUsernameModal.tsx`

Update the `handleContinue` method:

```typescript
const handleContinue = async () => {
  if (!username.trim()) return;
  
  setIsLoading(true);
  
  try {
    // Create guest session and get JWT token
    const response = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: username.trim() })
    });

    if (!response.ok) {
      throw new Error('Failed to create guest session');
    }

    const data = await response.json();
    
    if (data.success) {
      // Store JWT token
      sessionStorage.setItem('guestAuthToken', data.data.token);
      
      // Call the completion callback with user data
      onComplete(data.data.user);
    } else {
      throw new Error(data.message || 'Session creation failed');
    }
  } catch (error) {
    console.error('Guest session creation failed:', error);
    alert('Failed to create guest session. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

### 3. Complete Integration Flow

1. **User enters dashboard** → Guest username modal appears
2. **Modal generates random username** → User can edit it
3. **User clicks "Start Chatting"** → `POST /api/auth/guest` with username
4. **Backend creates session** → Returns JWT token and user data
5. **Frontend stores JWT token** → In `sessionStorage`
6. **Frontend connects socket** → Using JWT token in `auth.token`
7. **Backend authenticates socket** → Validates JWT, creates guest session
8. **Socket connected successfully** → Real-time chat ready

### 4. Testing the Integration

Start backend server:
```bash
cd backend
npm start
```

The backend should show:
```
✅ Server running on port http://0.0.0.0:3335
📡 Socket.IO server ready
```

Test the API endpoints:
```bash
# Test username generation
curl http://localhost:3335/api/auth/guest/username

# Test guest session creation
curl -X POST http://localhost:3335/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser123"}'
```

### 5. Expected Results

After integration:
- ✅ Frontend generates random username
- ✅ Guest session created with JWT token
- ✅ Socket.IO connects successfully with authentication
- ✅ Real-time presence and chat functionality works
- ✅ Mobile scroll behavior optimized

### 6. Security Features

- 🔒 JWT tokens expire after 2 hours
- 🧹 Automatic session cleanup for expired sessions
- 🛡️ All APIs protected with JWT middleware
- 📊 Real-time session tracking and statistics
- 🚫 Input sanitization and validation

## 📱 Mobile Chat Improvements

The mobile chat has been enhanced with:
- Stable keyboard handling (no unwanted scrolling during typing)
- Auto-scroll for new messages only when user is near bottom
- Fixed input positioning with mobile keyboard
- Optimized image preview layout
- WhatsApp/Telegram-like smooth behavior

## 🎉 Ready to Test!

The backend is running and ready. Update the frontend components as described above, and your guest authentication system will work perfectly!