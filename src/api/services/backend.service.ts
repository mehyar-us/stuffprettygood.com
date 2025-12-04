/**
 * Backend API Service
 * Service methods for Express backend on EC2
 */

import { backendApiClient } from '../client';

// Define your backend response types here
export interface BackendHealthResponse {
    status: string;
    timestamp: number;
}

export const backendService = {
    // Example: Health check endpoint
    getHealth: () => backendApiClient.get<BackendHealthResponse>('/health'),

    // Add more Express backend API methods here
};
