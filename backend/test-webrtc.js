/**
 * WebRTC Connection Diagnostic Test
 * 
 * This script simulates two users attempting a WebRTC call
 * to diagnose why calls get stuck at "connecting" state
 */

const io = require('socket.io-client');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3335';
const TEST_TIMEOUT = 30000; // 30 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, prefix, ...args) {
  console.log(`${color}${prefix}${colors.reset}`, ...args);
}

// Mock RTCSessionDescription and RTCIceCandidate
class MockRTCSessionDescription {
  constructor(init) {
    this.type = init.type;
    this.sdp = init.sdp || 'mock-sdp-data';
  }
}

class MockRTCIceCandidate {
  constructor(init) {
    this.candidate = init.candidate || 'candidate:mock';
    this.sdpMLineIndex = init.sdpMLineIndex || 0;
    this.sdpMid = init.sdpMid || '0';
  }
}

// Test state
const testState = {
  userA: {
    socket: null,
    token: null,
    sessionId: null,
    connected: false,
    matchedWith: null,
  },
  userB: {
    socket: null,
    token: null,
    sessionId: null,
    connected: false,
    matchedWith: null,
  },
  webrtc: {
    offerSent: false,
    offerReceived: false,
    answerSent: false,
    answerReceived: false,
    iceCandidatesA: 0,
    iceCandidatesB: 0,
  },
  testPassed: false,
  testFailed: false,
};

// Create guest session
async function createGuestSession(username) {
  const fetch = (await import('node-fetch')).default;
  
  log(colors.cyan, '📝', `Creating guest session for: ${username}`);
  
  const response = await fetch(`${BACKEND_URL}/api/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create guest session: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Guest session creation failed: ${data.message}`);
  }

  log(colors.green, '✅', `Guest session created for ${username}:`, data.data.user.id);
  
  return {
    token: data.data.token,
    sessionId: data.data.user.id,
  };
}

// Connect socket with authentication
function connectSocket(username, token) {
  return new Promise((resolve, reject) => {
    log(colors.cyan, '🔌', `Connecting socket for: ${username}`);
    
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    socket.on('connect', () => {
      log(colors.green, '✅', `${username} connected - Socket ID: ${socket.id}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      log(colors.red, '❌', `${username} connection error:`, error.message);
      reject(error);
    });

    socket.on('connection:established', (data) => {
      log(colors.green, '🎉', `${username} connection established:`, data);
    });
  });
}

// Setup event listeners for User A (Caller)
function setupUserAListeners(socket) {
  log(colors.blue, '👂', 'Setting up User A (Caller) listeners');

  socket.on('user:matched', (data) => {
    log(colors.green, '🤝', 'User A matched with:', data.matchedUser.username);
    testState.userA.matchedWith = data.matchedUser;
  });

  socket.on('webrtc:answer', (data) => {
    log(colors.magenta, '📞', 'User A received WebRTC answer from:', data.fromUsername);
    testState.webrtc.answerReceived = true;
    
    // Simulate accepting the answer
    log(colors.cyan, '🔧', 'User A: Setting remote description (answer)');
  });

  socket.on('webrtc:ice-candidate', (data) => {
    testState.webrtc.iceCandidatesA++;
    log(colors.cyan, '🧊', `User A received ICE candidate #${testState.webrtc.iceCandidatesA}`);
  });

  socket.on('webrtc:error', (error) => {
    log(colors.red, '❌', 'User A WebRTC error:', error.message);
  });
}

// Setup event listeners for User B (Callee)
function setupUserBListeners(socket) {
  log(colors.blue, '👂', 'Setting up User B (Callee) listeners');

  socket.on('user:matched', (data) => {
    log(colors.green, '🤝', 'User B matched with:', data.matchedUser.username);
    testState.userB.matchedWith = data.matchedUser;
  });

  socket.on('webrtc:offer', (data) => {
    log(colors.magenta, '📞', 'User B received WebRTC offer from:', data.fromUsername);
    log(colors.cyan, '📋', 'Offer type:', data.type);
    testState.webrtc.offerReceived = true;
    
    // Simulate accepting and sending answer after a short delay
    setTimeout(() => {
      log(colors.cyan, '🔧', 'User B: Creating and sending answer');
      
      const answer = new MockRTCSessionDescription({
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
      
      socket.emit('webrtc:answer', { answer });
      testState.webrtc.answerSent = true;
      log(colors.green, '✅', 'User B sent WebRTC answer');
      
      // Send some ICE candidates
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          const candidate = new MockRTCIceCandidate({
            candidate: `candidate:mock-b-${i}`,
            sdpMLineIndex: 0,
          });
          socket.emit('webrtc:ice-candidate', { candidate });
          log(colors.cyan, '🧊', `User B sent ICE candidate #${i + 1}`);
        }
      }, 500);
    }, 1000);
  });

  socket.on('webrtc:ice-candidate', (data) => {
    testState.webrtc.iceCandidatesB++;
    log(colors.cyan, '🧊', `User B received ICE candidate #${testState.webrtc.iceCandidatesB}`);
  });

  socket.on('webrtc:error', (error) => {
    log(colors.red, '❌', 'User B WebRTC error:', error.message);
  });
}

// Run the test
async function runTest() {
  log(colors.bright, '\n🧪', '=== WebRTC Connection Diagnostic Test ===\n');

  try {
    // Step 1: Create guest sessions
    log(colors.yellow, '📋', 'Step 1: Creating guest sessions...');
    const userASession = await createGuestSession('TestUserA');
    const userBSession = await createGuestSession('TestUserB');
    
    testState.userA.token = userASession.token;
    testState.userA.sessionId = userASession.sessionId;
    testState.userB.token = userBSession.token;
    testState.userB.sessionId = userBSession.sessionId;

    // Step 2: Connect sockets
    log(colors.yellow, '\n📋', 'Step 2: Connecting sockets...');
    testState.userA.socket = await connectSocket('User A', userASession.token);
    testState.userB.socket = await connectSocket('User B', userBSession.token);
    
    testState.userA.connected = true;
    testState.userB.connected = true;

    // Step 3: Setup listeners
    log(colors.yellow, '\n📋', 'Step 3: Setting up event listeners...');
    setupUserAListeners(testState.userA.socket);
    setupUserBListeners(testState.userB.socket);

    // Step 4: Match users
    log(colors.yellow, '\n📋', 'Step 4: Matching users...');
    testState.userA.socket.emit('user:match');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    testState.userB.socket.emit('user:match');
    
    // Wait for matching
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!testState.userA.matchedWith || !testState.userB.matchedWith) {
      throw new Error('Users failed to match');
    }

    // Step 5: Initiate WebRTC call
    log(colors.yellow, '\n📋', 'Step 5: Initiating WebRTC call from User A...');
    
    const offer = new MockRTCSessionDescription({
      type: 'offer',
      sdp: 'mock-offer-sdp',
    });
    
    testState.userA.socket.emit('webrtc:offer', {
      offer,
      type: 'video',
    });
    testState.webrtc.offerSent = true;
    log(colors.green, '✅', 'User A sent WebRTC offer');

    // Send some ICE candidates from User A
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        const candidate = new MockRTCIceCandidate({
          candidate: `candidate:mock-a-${i}`,
          sdpMLineIndex: 0,
        });
        testState.userA.socket.emit('webrtc:ice-candidate', { candidate });
        log(colors.cyan, '🧊', `User A sent ICE candidate #${i + 1}`);
      }
    }, 1500);

    // Wait for WebRTC signaling to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Analyze results
    log(colors.yellow, '\n📋', 'Step 6: Analyzing results...\n');
    
    const results = {
      'Users Connected': testState.userA.connected && testState.userB.connected,
      'Users Matched': !!testState.userA.matchedWith && !!testState.userB.matchedWith,
      'Offer Sent': testState.webrtc.offerSent,
      'Offer Received': testState.webrtc.offerReceived,
      'Answer Sent': testState.webrtc.answerSent,
      'Answer Received': testState.webrtc.answerReceived,
      'ICE Candidates A->B': testState.webrtc.iceCandidatesB,
      'ICE Candidates B->A': testState.webrtc.iceCandidatesA,
    };

    log(colors.bright, '📊', 'Test Results:');
    Object.entries(results).forEach(([key, value]) => {
      const status = value ? colors.green + '✅' : colors.red + '❌';
      log('', status, `${key}: ${value}`);
    });

    // Determine if test passed
    const allPassed = Object.values(results).every(v => v === true || v > 0);
    
    if (allPassed) {
      log(colors.green, '\n✅', 'All WebRTC signaling steps completed successfully!');
      log(colors.cyan, '💡', 'The backend WebRTC signaling is working correctly.');
      log(colors.yellow, '⚠️', 'If calls still fail, the issue is likely in:');
      log('', '  ', '1. Frontend RTCPeerConnection setup');
      log('', '  ', '2. STUN/TURN server configuration');
      log('', '  ', '3. Browser WebRTC implementation');
      log('', '  ', '4. Network/firewall restrictions');
      testState.testPassed = true;
    } else {
      log(colors.red, '\n❌', 'WebRTC signaling test failed!');
      log(colors.yellow, '💡', 'Issues detected:');
      
      if (!testState.webrtc.offerReceived) {
        log(colors.red, '  ', '- Offer not received by User B');
      }
      if (!testState.webrtc.answerSent) {
        log(colors.red, '  ', '- Answer not sent by User B');
      }
      if (!testState.webrtc.answerReceived) {
        log(colors.red, '  ', '- Answer not received by User A');
      }
      if (testState.webrtc.iceCandidatesA === 0) {
        log(colors.red, '  ', '- No ICE candidates received by User A');
      }
      if (testState.webrtc.iceCandidatesB === 0) {
        log(colors.red, '  ', '- No ICE candidates received by User B');
      }
      
      testState.testFailed = true;
    }

  } catch (error) {
    log(colors.red, '❌', 'Test failed with error:', error.message);
    testState.testFailed = true;
  } finally {
    // Cleanup
    log(colors.yellow, '\n🧹', 'Cleaning up...');
    
    if (testState.userA.socket) {
      testState.userA.socket.disconnect();
    }
    if (testState.userB.socket) {
      testState.userB.socket.disconnect();
    }
    
    log(colors.bright, '\n🏁', 'Test completed!\n');
    
    // Exit with appropriate code
    process.exit(testState.testPassed ? 0 : 1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(colors.red, '❌', 'Unhandled rejection:', error);
  process.exit(1);
});

// Set test timeout
setTimeout(() => {
  log(colors.red, '⏰', 'Test timeout - taking too long!');
  process.exit(1);
}, TEST_TIMEOUT);

// Run the test
runTest();
