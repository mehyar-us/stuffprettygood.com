import { useEffect, useState } from "react";

function App() {
  const [apiMessage, setApiMessage] = useState<string>("Loading...");

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const res = await fetch("https://api.stuffprettygood.com/hello");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setApiMessage(data.message ?? "No message field");
      } catch (err) {
        console.error(err);
        setApiMessage("Error talking to backend");
      }
    };

    fetchMessage();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>stuffprettygood.com</h1>
      <p>Frontend is working.</p>
      <h2>Backend says:</h2>
      <pre>{apiMessage}</pre>
    </div>
  );
}

export default App;