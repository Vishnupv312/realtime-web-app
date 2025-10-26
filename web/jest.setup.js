import '@testing-library/jest-dom'

// Mock Socket.IO client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    id: 'mock-socket-id',
  }

  return {
    io: jest.fn(() => mockSocket),
  }
})

// Mock Next.js environment variables
process.env.NEXT_PUBLIC_SOCKET_URL = 'http://localhost:3001'

// Mock js-cookie
jest.mock('js-cookie', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}))
