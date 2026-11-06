import { MapView } from '../features/map_view';
import { StrictMode, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { Connection, Mock, getRobotSession, disposeSessions } from '../core/robot';
import { Diagnostics } from '../features/diagnostics';
import { profile, useMock } from './config';
import './style.css';
const source = getRobotSession(profile.id, () => useMock ? new Mock(profile.url) : new Connection(profile.url));
if (import.meta.hot) import.meta.hot.dispose(disposeSessions);
const RobotContext = createContext(source);
function RegisteredDiagnostics() { return <Diagnostics source={useContext(RobotContext)} />; }
createRoot(document.getElementById('root')!).render(<StrictMode><RobotContext.Provider value={source}><main><MapView source={source} /><RegisteredDiagnostics /></main></RobotContext.Provider></StrictMode>);
