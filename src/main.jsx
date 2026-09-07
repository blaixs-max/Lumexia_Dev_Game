// DEV MODE: Solana WalletProvider tamamen kaldirildi.
// HUD/Game test ortami - cuzdan baglantisi, RPC, polyfill (Buffer) gerekmez.
//
// The race clock is advanced by the fixed simulation step, including countdown.
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
