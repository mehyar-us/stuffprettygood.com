/**
 * Base API client
 * Environment-aware HTTP client that routes to local worker in dev, production in prod
 */

import env from '../config/env';

export class ApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = env.apiUrl;
        console.log(`🌐 API Client initialized in ${env.isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
        console.log(`📡 API URL: ${this.baseURL}`);
    }

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        return response.json();
    }

    async post<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        return response.json();
    }
}

export const apiClient = new ApiClient();
