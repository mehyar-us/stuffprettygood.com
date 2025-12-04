/**
 * Store Module Exports
 * Central export point for Redux store functionality
 */

// Store
export { store } from './index';
export type { RootState, AppDispatch } from './index';

// Hooks
export { useAppDispatch, useAppSelector } from './hooks';

// Slices and Actions
export { increment, decrement, setMessage } from './slices/exampleSlice';
