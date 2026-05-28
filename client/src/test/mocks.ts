/**
 * Shared mock setup for component tests.
 * The socket module is mocked so no real network connections are opened.
 * Tests import this file via __mocks__ or direct jest.mock() calls.
 */

// Intentionally empty — socket is mocked per-file via jest.mock('../socket') or
// via __mocks__/socket.ts placed next to the socket module.
