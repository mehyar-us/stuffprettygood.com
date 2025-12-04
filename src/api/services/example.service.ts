/**
 * Example API Service
 * Demonstrates how to create API service methods
 */

import { apiClient } from '../client';

export interface HelloResponse {
    message: string;
}

export const exampleService = {
    getHello: () => apiClient.get<HelloResponse>('/hello'),

    // Add more API methods here as needed
};
