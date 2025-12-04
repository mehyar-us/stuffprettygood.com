/**
 * React Query Hooks for Example Service
 */

import { useQuery } from '@tanstack/react-query';
import { exampleService } from '../services/example.service';

/**
 * Hook to fetch hello message from API
 */
export const useHello = () => {
    return useQuery({
        queryKey: ['hello'],
        queryFn: () => exampleService.getHello(),
    });
};

// Add more hooks here as needed
