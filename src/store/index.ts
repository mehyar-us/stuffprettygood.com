/**
 * Redux Store Setup
 * Configured with Redux Toolkit
 */

import { configureStore } from '@reduxjs/toolkit';

// Import your slices here as they are created
import exampleReducer from './slices/exampleSlice';

export const store = configureStore({
    reducer: {
        // Add your reducers here
        example: exampleReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
