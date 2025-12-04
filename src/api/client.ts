/**
 * Base API clients
 * Environment-aware HTTP clients for Cloudflare Worker and Express Backend
 */

import env from '../config/env';

export class ApiClient {
    private baseURL: string;
    private name: string;

    constructor(baseURL: string, name: string) {
        this.baseURL = baseURL;
        this.name = name;
        console.log(`🌐 ${this.name} initialized in ${env.isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
        console.log(`📡 ${this.name} URL: ${this.baseURL}`);
    }

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`${this.name} Error: ${response.statusText}`);
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
            throw new Error(`${this.name} Error: ${response.statusText}`);
        }

        return response.json();
    }

    async put<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`${this.name} Error: ${response.statusText}`);
        }

        return response.json();
    }

    async delete<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`${this.name} Error: ${response.statusText}`);
        }

        return response.json();
    }
}

// Cloudflare Worker API Client (Serverless)
export const workerApiClient = new ApiClient(env.workerApiUrl, 'Worker API');

// Express Backend API Client (EC2)
export const backendApiClient = new ApiClient(env.backendApiUrl, 'Backend API');
