/**
 * Example API Service
 * Demonstrates how to create API service methods for Worker API
 */

import { workerApiClient } from '../client';

export interface HelloResponse {
    message: string;
}

export const exampleService = {
    // Using Cloudflare Worker API
    getHello: () => workerApiClient.get<HelloResponse>('/hello'),

    // Add more Worker API methods here as needed
};
