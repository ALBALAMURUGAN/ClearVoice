import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Practice from './pages/Practice';
import Exercises from './pages/Exercises';
import Progress from './pages/Progress';
import WordLab from './pages/WordLab';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/word-lab" element={<WordLab />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
