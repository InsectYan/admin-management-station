import { BrowserRouter } from 'react-router-dom';
import MainLayout from './components/MainLayout.jsx';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  );
}
