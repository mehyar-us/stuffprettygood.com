import { useHello } from './api/hooks/example.hooks';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { increment, decrement, setMessage } from './store/slices/exampleSlice';

function App() {
  // React Query - fetch data from API
  const { data, isLoading, error } = useHello();

  // Redux - local state management
  const dispatch = useAppDispatch();
  const count = useAppSelector((state) => state.example.count);
  const message = useAppSelector((state) => state.example.message);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>stuffprettygood.com</h1>

      {/* React Query Demo */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>🌐 API Call (React Query)</h2>
        {isLoading && <p>Loading from API...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
        {data && (
          <div>
            <p><strong>Backend says:</strong> {data.message}</p>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              ✓ Using environment-aware API client
            </p>
          </div>
        )}
      </section>

      {/* Redux Demo */}
      <section style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>🔄 Redux State Management</h2>
        <div style={{ marginBottom: '1rem' }}>
          <p><strong>Count:</strong> {count}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => dispatch(increment())}>Increment</button>
            <button onClick={() => dispatch(decrement())}>Decrement</button>
          </div>
        </div>

        <div>
          <p><strong>Message:</strong> {message || '(empty)'}</p>
          <input
            type="text"
            placeholder="Type a message..."
            onChange={(e) => dispatch(setMessage(e.target.value))}
            style={{ padding: '0.5rem', marginRight: '0.5rem' }}
          />
        </div>
      </section>

      <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#888' }}>
        Check console for API environment logs
      </p>
    </div>
  );
}

export default App;