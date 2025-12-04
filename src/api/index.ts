/**
 * API Module Exports
 * Central export point for all API-related functionality
 */

// API Client
export { apiClient, ApiClient } from './client';

// Services
export { exampleService } from './services/example.service';
export type { HelloResponse } from './services/example.service';

// Hooks
export { useHello } from './hooks/example.hooks';
