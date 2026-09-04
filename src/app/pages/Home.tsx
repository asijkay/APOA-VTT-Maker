import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    // Generate a simple random room ID
    const roomId = Math.random().toString(36).substring(2, 9);
    navigate(`/room/${roomId}?role=gm`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>APOA VTT Maker</h1>
      <p style={{ marginBottom: '2rem', color: '#aaa' }}>A fast, prototype virtual tabletop.</p>
      
      <button 
        onClick={handleCreateRoom}
        style={{
          padding: '12px 24px',
          fontSize: '1.2rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Create New Room
      </button>
    </div>
  );
}
